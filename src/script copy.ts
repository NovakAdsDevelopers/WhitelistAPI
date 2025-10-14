import express from "express";
import cors from "cors";
import cron from "node-cron";
import dotenv from "dotenv";
import pLimit from "p-limit";

// ▸ Serviços existentes (mantidos)
import {
  fetchAllAdAccounts,
  fetchAdAccountsByIds,
} from "./meta/services/AdAccounts";
import {
  ajusteDiarioLimitesAlerta,
  autoDisparoAlertas,
} from "./meta/services/limite";
import { registrarExecucao, tempoRestanteMs } from "./lib/cronTimer";
import { recalcularGastosDiarios } from "./meta/services/gastoDiario";
import { prisma } from "./database";
import { fetchFacebookToken } from "./meta/services/Token";
import {
  associateBMsTOAdAccounts,
  createORupdateBMs,
} from "./meta/services/BusinessManager";
import { renameAdAccountWithToken } from "./meta/services/Account";
import { getTokenForAdAccount } from "./meta/services/util";
import { getInterToken, pagarPixCopiaECola } from "./inter";

dotenv.config();

const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// =========================
// 🔧 Configuráveis por ENV
// =========================
const TZ = process.env.TZ || "America/Sao_Paulo"; // garante consistência dos agendamentos
const POOL_CONCURRENCY = Number(process.env.POOL_CONCURRENCY || 6); // paralelismo prudente
const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 25_000); // cada chamada de serviço
const RETRIES = Number(process.env.RETRIES || 2);

// =========================
// 🧠 Cache simples em memória
// =========================

type TokenRow = {
  id: number;
  token: string;
  title: string;
  client_id?: string;
  secret_id?: string;
};

let tokenCache: { data: TokenRow[]; exp: number } | null = null;
const TOKEN_TTL_MS = 5 * 60_000; // 5 minutos

async function getAllTokensCached(force = false): Promise<TokenRow[]> {
  const now = Date.now();
  if (!force && tokenCache && tokenCache.exp > now) return tokenCache.data;
  const started = performance.now();
  const tokens = await prisma.token.findMany();
  tokenCache = { data: tokens as TokenRow[], exp: now + TOKEN_TTL_MS };
  console.log(
    `🗄️ Tokens carregados: ${tokens.length} em ${ms(
      performance.now() - started
    )}`
  );
  return tokens as TokenRow[];
}

// =========================
// 🔁 Utilitários de execução
// =========================

const limit = pLimit(POOL_CONCURRENCY);

function ms(v: number) {
  return `${Math.round(v)}ms`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(maxMs = 2_000) {
  return Math.floor(Math.random() * maxMs);
}

async function withTimeout<T>(
  p: Promise<T>,
  timeoutMs = HTTP_TIMEOUT_MS
): Promise<T> {
  let to: NodeJS.Timeout;
  return Promise.race([
    p,
    new Promise<T>((_, rej) => {
      to = setTimeout(
        () => rej(new Error(`Timeout after ${timeoutMs}ms`)),
        timeoutMs
      );
    }),
  ]).finally(() => clearTimeout(to!));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = RETRIES
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const backoff = Math.min(1000 * (i + 1) + jitter(500), 5_000);
      if (i < retries) {
        console.warn(
          `↻ Retry ${i + 1}/${retries} em ${backoff}ms —`,
          (e as any)?.message || e
        );
        await sleep(backoff);
      }
    }
  }
  throw lastErr;
}

async function runPool<I, O>(
  items: I[],
  worker: (item: I, idx: number) => Promise<O>
): Promise<O[]> {
  const started = performance.now();
  const results = await Promise.allSettled(
    items.map((it, i) =>
      limit(() => withRetry(() => withTimeout(worker(it, i))))
    )
  );
  const ok: O[] = [];
  let errors = 0;
  results.forEach((r) => {
    if (r.status === "fulfilled") ok.push(r.value);
    else errors++;
  });
  console.log(
    `🏁 Pool concluído em ${ms(performance.now() - started)} | ok=${
      ok.length
    } err=${errors}`
  );
  return ok;
}

// =========================
// 🛡️ Tratador de erro HTTP
// =========================

const handleError = (
  res: express.Response,
  error: unknown,
  msg = "Erro interno"
) => {
  console.error("❌", msg, error);
  const errorMsg = (error as any)?.response?.data
    ? JSON.stringify((error as any).response.data)
    : (error as any)?.message || msg;
  return res.status(500).json({ error: errorMsg });
};

// =======================================
// 🔎 Rotas rápidas e não-bloqueantes (v2)
// =======================================

app.get("/tempo-restante-sync", (_req, res) => {
  const restanteMs = tempoRestanteMs();
  res.json({
    minutos: Math.floor(restanteMs / 60000),
    segundos: Math.floor((restanteMs % 60000) / 1000),
    totalMs: restanteMs,
  });
});

// Rota manual para sincronização geral
app.get("/sync-ads", async (req, res) => {
  try {
    console.log("🔄 Sincronização geral iniciada");

    const token = await prisma.token.findUnique(
      { where: { id: 2 } } // token específico (exemplo
    );
    // console.log(`🔹 Encontrados ${tokens.length} tokens`);

    const results: Record<string, any> = {};

    console.log(`🔄 Sincronizando contas para: ${token!.title}`);
    results[token!.title] = await fetchAllAdAccounts(token!.token);

    console.log("✅ Sincronização concluída.");
    res.status(200).json({
      message: "✅ Sincronização concluída.",
      result: results,
    });
  } catch (error: any) {
    console.error("❌ Erro na sincronização:", error);
    res.status(500).json({ error: error.message || "Erro na sincronização." });
  }
});

app.get("/sync-ads/:ad_account_id", async (req, res) => {
  const { ad_account_id } = req.params;
  if (!ad_account_id) return res.status(400).json({ error: "ID inválido" });
  try {
    const cleanId = String(ad_account_id).replace(/^act_/, "");
    await withRetry(() => withTimeout(fetchAdAccountsByIds([cleanId])));
    res.json({ message: `✅ Conta ${cleanId} sincronizada` });
  } catch (error) {
    handleError(res, error, `Erro ao sincronizar conta ${ad_account_id}`);
  }
});

app.post("/sync-ads-by-ids", async (req, res) => {
  const { account_ids } = req.body;
  if (!Array.isArray(account_ids) || !account_ids.length) {
    return res.status(400).json({ error: "IDs inválidos" });
  }
  const cleanIds = account_ids.map((id: string) =>
    String(id).replace(/^act_/, "")
  );
  try {
    // divide em lotes para evitar requests gigantes
    const chunkSize = 20;
    const chunks: string[][] = [];
    for (let i = 0; i < cleanIds.length; i += chunkSize)
      chunks.push(cleanIds.slice(i, i + chunkSize));

    await runPool(chunks, async (ids) => {
      await fetchAdAccountsByIds(ids);
      return { count: ids.length };
    });

    res.json({
      message: "✅ Contas sincronizadas",
      synchronized_accounts: cleanIds,
    });
  } catch (error) {
    handleError(res, error, "Erro ao sincronizar múltiplas contas");
  }
});

app.post("/sync-bms", async (_req, res) => {
  try {
    const tokens = await getAllTokensCached(true);
    await runPool(tokens, async (t) =>
      createORupdateBMs(t.token, Number(t.id))
    );
    res.json({ message: "✅ BMs sincronizadas" });
  } catch (error) {
    handleError(res, error, "Erro ao sincronizar BMs");
  }
});

app.post("/adaccount/:adAccountId/rename", async (req, res) => {
  const adAccountId = String(req.params.adAccountId || "");
  const newName = String(req.body?.newName || "");
  if (!adAccountId || !newName) {
    return res
      .status(400)
      .json({ error: "Informe adAccountId (na URL) e newName (no corpo)" });
  }
  try {
    const token = await getTokenForAdAccount(adAccountId);
    if (!token)
      return res
        .status(404)
        .json({ error: `Conta ${adAccountId} sem token associado` });

    const result = await withRetry(() =>
      withTimeout(renameAdAccountWithToken(token, adAccountId, newName))
    );
    res.json({
      message: "✅ Ad Account renomeada",
      adAccountId,
      newName,
      result,
    });
  } catch (error) {
    handleError(res, error, "Erro ao renomear Ad Account");
  }
});

import axios from "axios";
// importe suas funções como já usa hoje
// import { getInterToken, pagarPixCopiaECola } from "./onde/estao";

// URL da VM
const VM_URL = "http://52.67.69.212:8080/pix/run";

app.post("/payment-meta", async (req, res) => {
  try {
    const {
      business_id,
      asset_id,
      account_id,
      valor, // mesmo valor usado no FB e no Inter
      retornar_base64 = false,
    } = req.body ?? {};

    if (!business_id || !asset_id || !account_id || !valor) {
      return res.status(400).json({
        error: "business_id, asset_id, account_id, valor são obrigatórios.",
      });
    }
    if (!process.env.INTER_CLIENT_ID || !process.env.INTER_CLIENT_SECRET) {
      return res.status(500).json({
        error: "INTER_CLIENT_ID/INTER_CLIENT_SECRET ausentes no .env",
      });
    }

    // 1) chama a VM pra gerar o PIX no Facebook
    const vmResp = await axios.post(
      VM_URL,
      {
        business_id,
        asset_id,
        account_id,
        valor: String(valor),
        retornar_base64,
      },
      {
        timeout: 600_000,
        headers: { "Content-Type": "application/json" },
      }
    );

    const { success, codigo, image_url } = vmResp.data || {};
    if (!success || !codigo) {
      return res
        .status(502)
        .json({ error: "Falha ao obter PIX da VM", details: vmResp.data });
    }

    // 2) token Inter (env)
    const token = await getInterToken({
      clientId: process.env.INTER_CLIENT_ID!,
      clientSecret: process.env.INTER_CLIENT_SECRET!,
      scope: undefined, // sua função usa default "pagamento-pix.write"
      certPath: process.env.CERT_PATH, // se você usa
      keyPath: process.env.KEY_PATH, // se você usa
      passphrase: process.env.INTER_KEY_PASSPHRASE,
    });

    // 3) pagar Pix Copia e Cola usando o CÓDIGO retornado pela VM
    const pagamento = await pagarPixCopiaECola({
      token,
      emv: String(codigo), // << código BR Code da VM
      valor: valor, // mesmo valor
      certPath: process.env.CERT_PATH,
      keyPath: process.env.KEY_PATH,
      passphrase: process.env.INTER_KEY_PASSPHRASE,
    });

    // 4) resposta final
    return res.status(200).json({
      success: true,
      pix: { codigo, image_url },
      pagamento,
    });
  } catch (err: any) {
    if (err.response) {
      return res.status(err.response.status).json({
        error: "upstream_error",
        from: err.config?.url?.includes("/pix/run") ? "vm" : "inter",
        details: err.response.data,
      });
    }
    return res.status(500).json({ error: err.message || String(err) });
  }
});

/* ------------------------------------------------------------------
 ⏰ CRONS (com locks, pool e timezone) 
-------------------------------------------------------------------*/

const locks: Record<string, boolean> = {};
function withLock(key: string, fn: () => Promise<void>) {
  return async () => {
    if (locks[key])
      return console.warn(
        `⏳ Skip ${key}: execução anterior ainda em andamento`
      );
    locks[key] = true;
    const started = performance.now();
    try {
      await fn();
      console.log(`✅ ${key} ok em ${ms(performance.now() - started)}`);
    } catch (e) {
      console.error(`❌ ${key} falhou:`, e);
    } finally {
      locks[key] = false;
    }
  };
}

// 1) Atualizar tokens do Meta no 1º dia do mês (00:00) — com leve jitter
cron.schedule(
  "0 0 1 * *",
  withLock("cron_tokens", async () => {
    await sleep(jitter());
    const tokens = await getAllTokensCached(true);
    await runPool(tokens, async (t) =>
      fetchFacebookToken((t as any).client_id, (t as any).secret_id, t.title)
    );
  }),
  { timezone: TZ }
);

// 2) Sincronizar contas a cada 50 minutos
cron.schedule(
  "*/50 * * * *",
  withLock("cron_contas", async () => {
    await sleep(jitter());
    const tokens = await getAllTokensCached(true);
    await runPool(tokens, async (t) => fetchAllAdAccounts(t.token));
    registrarExecucao();
  }),
  { timezone: TZ }
);

// 3) Alertas a cada 30 minutos
cron.schedule(
  "*/30 * * * *",
  withLock("cron_alertas", async () => {
    await sleep(jitter());
    await withRetry(() => withTimeout(autoDisparoAlertas()));
  }),
  { timezone: TZ }
);

// 4) Ajuste diário às 9h
cron.schedule(
  "0 9 * * *",
  withLock("cron_limites", async () => {
    await withRetry(() => withTimeout(ajusteDiarioLimitesAlerta()));
  }),
  { timezone: TZ }
);

// 5) Atualizar BMs no dia 3 à meia-noite
cron.schedule(
  "0 0 3 * *",
  withLock("cron_bms", async () => {
    await sleep(jitter());
    const tokens = await getAllTokensCached(true);
    await runPool(tokens, async (t) =>
      createORupdateBMs(t.token, Number(t.id))
    );
  }),
  { timezone: TZ }
);

// 6) Recalcular gastos diariamente às 0h (pool + associação de BMs)
cron.schedule(
  "0 0 * * *",
  withLock("cron_gastos", async () => {
    await withRetry(() => withTimeout(recalcularGastosDiarios()));
    const allBMs = await prisma.bM.findMany({ include: { token: true } });
    await runPool(allBMs, async (bm) => {
      if (bm.token?.token)
        return associateBMsTOAdAccounts(bm.BMId, bm.token.token);
      console.warn(`⚠️ BM ${bm.BMId} sem token associado`);
    });
  }),
  { timezone: TZ }
);

// =======================================
// ♻️ Liveness/Readiness + Boot Log
// =======================================

app.get("/health", (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString() })
);

app.get("/ready", async (_req, res) => {
  try {
    const tokens = await getAllTokensCached();
    res.json({ ok: tokens.length > 0, tokens: tokens.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as any)?.message });
  }
});

async function syncBMsToAdAccounts() {
  // pega só BMs com tokenId = 2 (e já traz o token relacionado)
  const allBMs = await prisma.bM.findMany({
    where: { tokenId: 2 },
    include: { token: true },
  });

  await runPool(allBMs, async (bm) => {
    if (bm.token?.token) {
      await associateBMsTOAdAccounts(bm.BMId, bm.token.token);
      console.log(`✅ BM ${bm.nome} sincronizada`);
    }
    console.warn(`⚠️ BM ${bm.BMId} sem token associado`);
  });
}

// executar no start da API
(async () => {
  await syncBMsToAdAccounts();
  console.log("🚀 Meta API Scheduler v2 (rápido & resiliente) iniciado");
})();

export { app as metaSync };
