import jwt from "jsonwebtoken";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cron from "node-cron";

import { prisma } from "./database";
import {
  fetchAdAccountsByIds,
  fetchAllAdAccounts,
} from "./meta/services/AdAccounts";
import {
  associateBMsTOAdAccounts,
  createORupdateBMs,
} from "./meta/services/BusinessManager";
import { getTokenForAdAccount } from "./meta/services/util";
import { renameAdAccountWithToken } from "./meta/services/Account";
import axios from "axios";
import {
  consultarExtratoCompleto,
  consultarPix,
  consultarSaldo,
  getInterToken,
  pagarPixCopiaECola,
} from "./inter";
import { intervaloUltimos6Dias } from "./inter/util";
import { startCronJobs } from "./cronJobs";
import { fetchFacebookToken } from "./meta/services/Token";
import { recalcularGastosDiarios } from "./meta/services/gastoDiario";
import { consultarExtratoJob, salvarExtratoJob } from "./inter/extrato-service";
import { handleError } from "./utils/handleError";

// ────────────────────────────────────────────────────────────────────────────────
// ENV & APP
// ────────────────────────────────────────────────────────────────────────────────
dotenv.config();

const app = express();
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
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
app.get("/sync-ads/:date?", async (req, res) => {
  try {
    console.log("🔄 Sincronização geral iniciada");

    // 1) Data: path param tem prioridade; fallback para ?date=
    const dateStr = (req.params.date ?? req.query.date)?.toString();

    // 2) Validação simples (YYYY-MM-DD) e conversão
    let date: Date | undefined;
    if (dateStr) {
      const isoDay = /^\d{4}-\d{2}-\d{2}$/;
      if (!isoDay.test(dateStr)) {
        return res
          .status(400)
          .json({ error: 'Parâmetro "date" inválido. Use YYYY-MM-DD.' });
      }
      const [y, m, d] = dateStr.split("-").map(Number);
      // Início do dia (ajuste para UTC se preferir)
      date = new Date(y, m - 1, d, 0, 0, 0, 0);
      console.log(`📅 Data alvo: ${dateStr}`);
    }

    // 3) Busca tokens
    const tokens = await prisma.token.findMany();
    console.log(`🔹 Encontrados ${tokens.length} tokens`);

    // 4) Sincroniza cada token, repassando a data (opcional)
    const results: Record<string, unknown> = {};
    for (const token of tokens) {
      console.log(`🔄 Sincronizando contas para: ${token.title}`);
      results[token.title] = await fetchAllAdAccounts(token.token, date);
    }

    console.log("✅ Sincronização concluída.");
    return res.status(200).json({
      message: "✅ Sincronização concluída.",
      date: dateStr ?? null,
      result: results,
    });
  } catch (error: any) {
    console.error("❌ Erro na sincronização:", error);
    return res
      .status(500)
      .json({ error: error.message ?? "Erro na sincronização." });
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
    await fetchAdAccountsByIds(cleanIds);

    res.json({
      message: "✅ Contas sincronizadas",
      synchronized_accounts: cleanIds,
    });
  } catch (error) {
    handleError(res, error, "Erro ao sincronizar múltiplas contas");
  }
});

app.get("/sync-ads/ad_account/:ad_account_id", async (req, res, next) => {
  const { ad_account_id } = req.params;

  if (!ad_account_id) {
    return res.status(400).json({ error: "ID inválido" });
  }

  const cleanId = String(ad_account_id).replace(/^act_/, "");

  await fetchAdAccountsByIds([cleanId]);

  return res.json({
    message: `✅ Conta ${cleanId} sincronizada`,
  });
});

app.get("/update-tokens", async (req, res) => {
  console.log("🔄 ROTA: Atualizando tokens do Meta sob demanda...");

  try {
    const tokensDb = await prisma.token.findMany();
    console.log(`🔹 Encontrados ${tokensDb.length} tokens`);

    const results: Record<string, string> = {};

    for (const token of tokensDb) {
      try {
        console.log(`🔄 Renovando token para: ${token.title}`);

        await fetchFacebookToken(token.client_id, token.secret_id, token.title);

        results[token.title] = "✅ Token atualizado com sucesso";
      } catch (innerError: any) {
        console.error(
          `❌ Erro ao renovar token de ${token.title}:`,
          innerError
        );
        results[token.title] = `❌ Falha ao atualizar: ${
          innerError.message || "erro desconhecido"
        }`;
      }
    }

    console.log("✅ Todos os tokens processados.");
    return res.status(200).json({
      message: "✅ Atualização manual de tokens concluída.",
      results,
    });
  } catch (error: any) {
    console.error("❌ Erro geral ao atualizar tokens:", error);
    return res.status(500).json({
      error: error.message || "Erro ao atualizar tokens do Meta.",
    });
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
  const start = Date.now();
  console.log(
    "🟢 [payment-meta] Iniciando requisição:",
    new Date().toISOString()
  );

  try {
    // 1️⃣ autenticação via cookie
    const token = req.cookies?.jwt;
    if (!token) {
      console.warn("⚠️ [payment-meta] Nenhum cookie JWT encontrado.");
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
      console.log("✅ [payment-meta] Token decodificado:", decoded);
    } catch (err) {
      console.error("❌ [payment-meta] Falha ao validar token:", err);
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }

    // 2️⃣ garante que o usuário ainda existe no banco
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { id: true, nome: true, email: true, tipo: true },
    });

    if (!usuario) {
      console.warn("⚠️ [payment-meta] Usuário não encontrado:", decoded.id);
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    console.log(
      `👤 [payment-meta] Usuário autenticado: ${usuario.nome} (${usuario.id})`
    );

    // 3️⃣ valida body
    const {
      business_id,
      asset_id,
      account_id,
      valor,
      retornar_base64 = false,
    } = req.body ?? {};
    console.log("📦 [payment-meta] Dados recebidos:", {
      business_id,
      asset_id,
      account_id,
      valor,
    });

    if (!business_id || !asset_id || !account_id || !valor) {
      console.warn("⚠️ [payment-meta] Campos obrigatórios ausentes:", req.body);
      return res.status(400).json({
        error: "business_id, asset_id, account_id, valor são obrigatórios.",
      });
    }

    if (!process.env.INTER_CLIENT_ID || !process.env.INTER_CLIENT_SECRET) {
      console.error(
        "❌ [payment-meta] INTER_CLIENT_ID/SECRET ausentes no .env"
      );
      return res.status(500).json({
        error: "INTER_CLIENT_ID/INTER_CLIENT_SECRET ausentes no .env",
      });
    }

    // 4️⃣ busca o nome do BM no banco
    console.log("🔎 [payment-meta] Buscando nome do BM pelo ID:", business_id);

    const bm = await prisma.bM.findUnique({
      where: { BMId: business_id }, // ajuste conforme o nome real do campo no seu schema
      select: { nome: true, BMId: true },
    });

    if (!bm) {
      console.warn(
        `⚠️ [payment-meta] BM com ID ${business_id} não encontrado.`
      );
    } else {
      console.log(`✅ [payment-meta] BM encontrado: ${bm.nome} (${bm.BMId})`);
    }

    const bmNome = bm?.nome || "BM não encontrado";

    // 5️⃣ chama a VM
    console.log("➡️ [payment-meta] Chamando VM_URL:", VM_URL);
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

    console.log("⬅️ [payment-meta] Resposta da VM:", vmResp.data);

    const { success, codigo, image_url } = vmResp.data || {};
    if (!success || !codigo) {
      console.error("❌ [payment-meta] Falha ao gerar PIX na VM:", vmResp.data);
      return res
        .status(502)
        .json({ error: "Falha ao obter PIX da VM", details: vmResp.data });
    }

    // 7️⃣ token Inter
    console.log("🔑 [payment-meta] Obtendo token Inter...");
    const tokenInter = await getInterToken({
      clientId: process.env.INTER_CLIENT_ID!,
      clientSecret: process.env.INTER_CLIENT_SECRET!,
      scope: undefined,
      certPath: process.env.CERT_PATH,
      keyPath: process.env.KEY_PATH,
      passphrase: process.env.INTER_KEY_PASSPHRASE,
    });
    console.log("✅ [payment-meta] Token Inter obtido.");

    const accountName = await prisma.adAccount.findUnique({
      where: { id: account_id },
      select: { nome: true },
    });

    // 8️⃣ pagamento PIX
    console.log("💸 [payment-meta] Iniciando pagamento PIX via Inter...");
    const pagamento = await pagarPixCopiaECola({
      token: tokenInter,
      emv: String(codigo),
      valor: valor,
      descricao: `NovakPanel - Operador:${usuario.nome} - Conta:${
        accountName?.nome || account_id
      }`,
      certPath: process.env.CERT_PATH,
      keyPath: process.env.KEY_PATH,
      passphrase: process.env.INTER_KEY_PASSPHRASE,
    });
    console.log("✅ [payment-meta] Pagamento PIX realizado:", pagamento);

    // 6️⃣ salva o registro
    console.log("📝 [payment-meta] Salvando registro no banco...");

    try {
      // opcional: verifica se a conta realmente existe antes
      const adAccount = await prisma.adAccount.findUnique({
        where: { id: account_id },
        select: { id: true, nome: true },
      });

      if (!adAccount) {
        console.warn(
          `⚠️ [payment-meta] AdAccount não encontrada: ${account_id}`
        );
        return res.status(404).json({ error: "AdAccount não encontrada." });
      }

      const nowIsoTime = new Date().toISOString().split("T")[1];

      // monta "YYYY-MM-DDThh:mm:ss.sssZ"
      const dataPagamentoISO = `${pagamento.dataPagamento}T${nowIsoTime}`;
      const dataOperacaoISO = `${pagamento.dataOperacao}T${nowIsoTime}`;

      const metaPix = await prisma.metaPix.create({
        data: {
          bmId: business_id,
          bmNome: bmNome,
          codigoCopiaCola: String(codigo),
          imageUrl: image_url,
          valor: Number(valor), // tipo correto para Decimal
          usuarioId: String(usuario.id),
          usuarioNome: usuario.nome,
          accountId: account_id, // ✅ usa apenas o campo direto
          createdAt: new Date(),
          tipoRetorno: pagamento.tipoRetorno,
          codigoSolicitacao: pagamento.codigoSolicitacao,
          dataPagamento: new Date(dataPagamentoISO),
          dataOperacao: new Date(dataOperacaoISO),
        },
      });

      //BASTA CONVERTER A STRING PARA DATA
      console.log("✅ [payment-meta] Registro salvo com sucesso:", metaPix.id);
    } catch (err: any) {
      console.error("❌ [payment-meta] Erro ao salvar registro:", err);
      return res.status(500).json({
        error: "Falha ao salvar registro no banco",
        details: err.message || String(err),
      });
    }

    // 9️⃣ sucesso final
    const ms = Date.now() - start;
    console.log(`✅ [payment-meta] Finalizado com sucesso em ${ms}ms.\n`);

    return res.status(200).json({
      success: true,
      pix: { codigo, image_url },
      pagamento,
    });
  } catch (err: any) {
    console.error("💥 [payment-meta] Erro inesperado:", err);
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

app.get("/consult-pix/:codigo", async (req, res) => {
  try {
    const { codigo } = req.params;
    if (!codigo) {
      return res
        .status(400)
        .json({ error: "Código da solicitação é obrigatório." });
    }

    // 1️⃣ Obter token com escopo de leitura
    const token = await getInterToken({
      clientId: process.env.INTER_CLIENT_ID!,
      clientSecret: process.env.INTER_CLIENT_SECRET!,
      scope: "pagamento-pix.read", // 👈 escopo correto pra consultar
      passphrase: process.env.INTER_CERT_PASSPHRASE,
    });

    // 2️⃣ Consultar o PIX na API do Inter
    const resultado = await consultarPix({
      token,
      codigoSolicitacao: codigo,
    });

    // 3️⃣ Retornar resultado formatado
    return res.json({
      status: resultado.status,
      pago: resultado.pago,
      valor: resultado.valor,
      dataHoraMovimento: resultado.dataHoraMovimento,
      dataHoraSolicitacao: resultado.dataHoraSolicitacao,
      codigoSolicitacao: resultado.codigoSolicitacao,
      raw: resultado.raw, // opcional: resposta completa do Inter
    });
  } catch (error: any) {
    console.error("❌ Erro na consulta de PIX:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Erro na consulta de PIX." });
  }
});

export type TipoOperacao = "C" | "D";

export type TransacaoExtrato = {
  /** Data de entrada ou inclusão da transação (com hora) */
  dataInclusao?: string;

  /** Data efetiva da transação (formato YYYY-MM-DD) */
  dataTransacao?: string;

  /** Data de entrada usada em versões antigas — mantida por compatibilidade */
  dataEntrada?: string;

  /** Tipo de operação: C (crédito) ou D (débito) */
  tipoOperacao?: TipoOperacao;

  /** Tipo da transação (PIX, boleto, TED, etc.) */
  tipoTransacao?: string;

  /** Valor da transação */
  valor?: string | number;

  /** Título da transação, caso exista */
  titulo?: string;

  /** Descrição ou detalhamento da transação */
  descricao?: string;

  /** Identificadores opcionais que às vezes vêm do Inter */
  idTransacao?: string;
  nsu?: string;
  id?: string;
};

app.get("/consult-extrato", async (req, res) => {
  try {
    const result = await consultarExtratoJob({
      tipo: req.query.tipo as any,
      tipoTransacao: req.query.tipoTransacao as string,
      dataInicio: req.query.dataInicio as string,
      dataFim: req.query.dataFim as string,
      order: req.query.order as "asc" | "desc",
      pagina: req.query.pagina ? Number(req.query.pagina) : undefined,
      tamanhoPagina: req.query.tamanhoPagina
        ? Number(req.query.tamanhoPagina)
        : undefined,
    });

    res.json(result);
  } catch (error: any) {
    console.error("❌ Erro na rota /consult-extrato:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/consult-saldo", async (req, res) => {
  try {
    const { dataSaldo } = req.query as { dataSaldo?: string };

    // 1) Token com escopo correto
    const token = await getInterToken({
      clientId: process.env.INTER_CLIENT_ID!,
      clientSecret: process.env.INTER_CLIENT_SECRET!,
      scope: "extrato.read",
      passphrase: process.env.INTER_CERT_PASSPHRASE,
    });

    // 2) Consulta de saldo no Inter
    const saldo = await consultarSaldo({
      token,
      dataSaldo, // opcional; se não enviar, pega o saldo atual
    });

    // 3) Retorna apenas o saldo disponível
    return res.json({ disponivel: Number(saldo?.disponivel ?? 0) });
  } catch (error: any) {
    console.error("❌ Erro na consulta de saldo:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Erro ao consultar saldo." });
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
          error: err?.response?.data
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
      return res
        .status(404)
        .json({ error: "Integração (Token) não encontrada." });
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
          error: err?.response?.data
            ? JSON.stringify(err.response.data)
            : err?.message || String(err),
        });
      }
    }

    return res.status(200).json({
      message:
        "✅ Associação de Ad Accounts concluída para a integração especificada.",
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

// Rota que lança erro síncrono (gera 500 -> loga)
app.get("/test-error-sync", (_req, _res) => {
  throw new Error("teste-log-express-sync");
});

// Rota que lança erro assíncrono (gera 500 -> loga)
app.get("/test-error-async", async (_req, _res, next) => {
  try {
    throw new Error("teste-log-express-async");
  } catch (e) {
    next(e);
  }
});

// Rota ok (controle)
app.get("/test-ok", (_req, res) => {
  res.json({ ok: true });
});

// ────────────────────────────────────────────────────────────────────────────────
// STARTUP
// ────────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log("🚀 Meta API iniciado");
  console.log("🕓 Iniciando automações CRON..");
  startCronJobs();
})();

export { app as metaSync };
