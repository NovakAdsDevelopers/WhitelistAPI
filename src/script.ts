import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cron from "node-cron";

import { prisma } from "./database";
import { fetchAllAdAccounts } from "./meta/services/AdAccounts";
import { associateBMsTOAdAccounts, createORupdateBMs } from "./meta/services/BusinessManager";
import { getTokenForAdAccount } from "./meta/services/util";
import { renameAdAccountWithToken } from "./meta/services/Account";
import { recalcularGastosDiarios } from "./meta/services/gastoDiario";
import axios from "axios";
import { getInterToken, pagarPixCopiaECola } from "./inter";

// ────────────────────────────────────────────────────────────────────────────────
// ENV & APP
// ────────────────────────────────────────────────────────────────────────────────
dotenv.config();

const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// ────────────────────────────────────────────────────────────────────────────────
// CONSTANTES (mantidas mesmo se não usadas, para não alterar comportamento)
// ────────────────────────────────────────────────────────────────────────────────
const API_URL = `${process.env.META_MARKETING_API_URL}/me/adaccounts`;
const CLIENT_ID = `${process.env.FB_CLIENT_ID_1}`;
const APP_SECRET = `${process.env.FB_CLIENT_SECRET_1}`;

// Promessa com tokens (utilizada em /sync-bms)
const tokens = prisma.token.findMany();

// ────────────────────────────────────────────────────────────────────────────────
/** ROTA: Sincronização geral (manual) */
// ────────────────────────────────────────────────────────────────────────────────
app.get("/sync-ads", async (req, res) => {
  try {
    console.log("🔄 Sincronização geral iniciada");

    const tokens = await prisma.token.findMany();
    console.log(`🔹 Encontrados ${tokens.length} tokens`);

    const results: Record<string, any> = {};

    for (const token of tokens) {
      console.log(`🔄 Sincronizando contas para: ${token.title}`);
      results[token.title] = await fetchAllAdAccounts(token.token);
    }

    console.log("✅ Sincronização concluída.");
    return res.status(200).json({
      message: "✅ Sincronização concluída.",
      result: results,
    });
  } catch (error: any) {
    console.error("❌ Erro na sincronização:", error);
    return res
      .status(500)
      .json({ error: error.message || "Erro na sincronização." });
  }
});

// ────────────────────────────────────────────────────────────────────────────────
/** ROTA: Sincronização de Business Managers (manual) */
// ────────────────────────────────────────────────────────────────────────────────
app.post("/sync-bms", async (req, res) => {
  try {
    (await tokens).map(async (token) => {
      createORupdateBMs(token.token, token.id);
    });

    return res.status(200).json({
      message: "✅ BMs sincronizadas.",
    });
  } catch (error: any) {
    console.error("❌ Erro ao sincronizar BMs:", error);
    return res
      .status(500)
      .json({ error: error.message || "Erro na sincronização." });
  }
});

// ────────────────────────────────────────────────────────────────────────────────
/** ROTA: Renomear Ad Account na aplicação e no Meta */
// ────────────────────────────────────────────────────────────────────────────────
app.post("/adaccount/:adAccountId/rename", async (req, res) => {
  try {
    const adAccountId = String(req.params.adAccountId || "");
    const newName = String(req.body?.newName || "");

    if (!adAccountId || !newName) {
      return res.status(400).json({
        error: "Informe adAccountId (na URL) e newName (no corpo).",
      });
    }

    // 1) Buscar token via BM associada
    const token = await getTokenForAdAccount(adAccountId);
    if (!token) {
      return res.status(404).json({
        error: `Conta ${adAccountId} não está associada a nenhuma BM/token.`,
      });
    }

    // 2) Renomear no Meta + atualizar no banco
    const result = await renameAdAccountWithToken(token, adAccountId, newName);

    // 3) Resposta única
    return res.status(200).json({
      message: "✅ Ad Account renomeada.",
      adAccountId,
      newName,
      result, // payload retornado pela Graph API
    });
  } catch (error: any) {
    console.error("❌ Erro ao renomear Ad Account:", error);
    const msg = error?.response?.data
      ? `Graph API: ${JSON.stringify(error.response.data)}`
      : error?.message || "Erro ao renomear.";
    return res.status(500).json({ error: msg });
  }
});

// ────────────────────────────────────────────────────────────────────────────────
/** ROTA: MACRO PIX */
// ────────────────────────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────────────────────────
/** ROTA: Associação das contas de anuncio à BMs */
// ────────────────────────────────────────────────────────────────────────────────

app.post("/bms/associate-adaccounts", async (req, res) => {
  try {
    // Busca todas as BMs
    const allBMs = await prisma.bM.findMany({
      include: { token: true }, // assumindo que cada BM tem um relacionamento com o token
    });

    const results: Array<{
      BMId: string;
      ok: boolean;
      error?: string;
      payload?: any;
    }> = [];

    let processed = 0;
    let skipped = 0;

    for (const bm of allBMs) {
      const BMId = bm.BMId;
      const token = bm.token?.token; // pega o token associado à BM

      if (!token) {
        console.warn(`⚠️ BM ${BMId} não possui token associado. Ignorando.`);
        skipped++;
        continue;
      }

      console.log(`🔹 Associando BM ${BMId} com seu token.`);

      try {
        const payload = await associateBMsTOAdAccounts(BMId, token);
        processed++;
        results.push({ BMId, ok: true, payload });
      } catch (err: any) {
        console.error(`❌ Erro ao associar BM ${BMId}:`, err);
        results.push({
          BMId,
          ok: false,
          error:
            err?.response?.data
              ? JSON.stringify(err.response.data)
              : err?.message || String(err),
        });
      }
    }

    return res.status(200).json({
      message: "✅ Associação de BMs às Ad Accounts concluída.",
      total: allBMs.length,
      processed,
      skipped,
      results,
    });
  } catch (error: any) {
    console.error("❌ CRON erro ao associar BMs:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Erro ao associar BMs." });
  }
});

app.post("/bms/associate-adaccounts/:idIntegracao", async (req, res) => {
  try {
    const { idIntegracao } = req.params;
    const tokenId = Number(idIntegracao);

    // Busca o token e suas BMs associadas
    const token = await prisma.token.findUnique({
      where: { id: tokenId },
      include: { bms: true },
    });

    if (!token) {
      return res.status(404).json({ error: "Integração (Token) não encontrada." });
    }

    if (!token.bms || token.bms.length === 0) {
      return res.status(404).json({
        error: "Nenhuma BM associada a esta integração.",
      });
    }

    const results: Array<{
      BMId: string;
      ok: boolean;
      error?: string;
      payload?: any;
    }> = [];

    for (const bm of token.bms) {
      const BMId = bm.BMId;
      const accessToken = token.token;

      if (!accessToken) {
        console.warn(`⚠️ BM ${BMId} não possui token válido.`);
        results.push({
          BMId,
          ok: false,
          error: "Token não encontrado ou inválido.",
        });
        continue;
      }

      console.log(`🔹 Associando BM ${BMId} (token ${tokenId})...`);

      try {
        const payload = await associateBMsTOAdAccounts(BMId, accessToken);
        results.push({ BMId, ok: true, payload });
      } catch (err: any) {
        console.error(`❌ Erro ao associar BM ${BMId}:`, err);
        results.push({
          BMId,
          ok: false,
          error:
            err?.response?.data
              ? JSON.stringify(err.response.data)
              : err?.message || String(err),
        });
      }
    }

    return res.status(200).json({
      message: "✅ Associação de Ad Accounts concluída para a integração especificada.",
      tokenId,
      totalBMs: token.bms.length,
      results,
    });
  } catch (error: any) {
    console.error("❌ Erro na rota de associação de BM específica:", error);
    return res.status(500).json({
      error: error?.message || "Erro ao associar BM.",
    });
  }
});



// ────────────────────────────────────────────────────────────────────────────────
// Automações (CRON)
// ────────────────────────────────────────────────────────────────────────────────

// CRON: Ajuste de alertas a cada 30 minutos
//  cron.schedule("*/30 * * * *", async () => {
//    try {
//      console.log("⚠️ CRON: Disparando alertas automáticos...");
//      await autoDisparoAlertas();
//    } catch (error) {
//      console.error("❌ CRON erro ao disparar alertas:", error);
//    }
//  });

//  // CRON: Tarefa às 9h para ajustes diários
//  cron.schedule("0 9 * * *", async () => {
//    console.log("☀️ CRON: Ajuste de limites diários...");
//    try {
//      await Promise.all([ajusteDiarioLimitesAlerta()]);
//    } catch (error) {
//      console.error("❌ CRON erro no ajuste de limites:", error);
//    }
//  });

// CRON: Verifica, Cria ou atualiza BMs todo dia 3 à meia-noite
//  cron.schedule("0 0 3 * *", async () => {
//    console.log("🕛 Iniciando atualização de BMs no dia 3 à meia-noite...");

//    try {
//      const tokensList = await tokens;  // sua função que retorna os tokens

//      for (const token of tokensList) {
//        console.log(`🔹 Token carregado para: ${token.title}`);
//        await createORupdateBMs(token.token, token.id);
//      }

//      console.log("✅ Todas as BMs foram atualizadas com sucesso!");
//    } catch (error) {
//      console.error("❌ Erro ao atualizar BMs:", error);
//    }
//  });

// // // CRON: Recalcular gastos diariamente às 0h
//  cron.schedule("0 0 * * *", async () => {
//    try {
//      await recalcularGastosDiarios();
//      console.log("📊 CRON: Recalculo de gastos concluído.");

//      // Busca todas as BMs
//      const allBMs = await prisma.bM.findMany({
//        include: { token: true }, // assumindo que cada BM tem um relacionamento com o token
//      });

//      for (const bm of allBMs) {
//        const BMId = bm.BMId;
//        const token = bm.token?.token; // pega o token associado à BM

//        if (!token) {
//          console.warn(`⚠️ BM ${BMId} não possui token associado. Ignorando.`);
//          continue;
//        }

//        console.log(`🔹 Associando BM ${BMId} com seu token.`);
//        await associateBMsTOAdAccounts(BMId, token);
//      }
//    } catch (error) {
//      console.error("❌ CRON erro ao recalcular gastos:", error);
//    }
//  });

// ────────────────────────────────────────────────────────────────────────────────
// STARTUP
// ────────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log("🚀 Meta API iniciado");
})();

export { app as metaSync };
