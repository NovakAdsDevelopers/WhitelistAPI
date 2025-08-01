import express, { Application } from "express";
import cron from "node-cron";
import dotenv from "dotenv";
import cors from "cors";
import {
  fetchAdAccountsByIds,
  fetchAllAdAccounts,
} from "./meta/services/AdAccounts";
import {
  ajusteDiarioLimitesAlerta,
  autoDisparoAlertas,
} from "./meta/services/limite";
import { registrarExecucao, tempoRestanteMs } from "./lib/cronTimer";
import { recalcularGastosDiarios } from "./meta/services/gastoDiario";

dotenv.config();

const app = express();
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

const TOKEN1 = process.env.TOKEN_ACCESS_META;
const TOKEN2 = process.env.TOKEN_ACCESS_META2;

const API_URL = `${process.env.META_MARKETING_API_URL}/me/adaccounts`;

app.get("/tempo-restante-sync", (req, res) => {
  const restanteMs = tempoRestanteMs();
  const minutos = Math.floor(restanteMs / 60000);
  const segundos = Math.floor((restanteMs % 60000) / 1000);

  res.json({ minutos, segundos, totalMs: restanteMs });
});

// Sincronização geral manual
app.get("/sync-ads", async (req, res) => {
  console.log("🖥️ Rota /sync-ads acionada!");
  try {
    const resToken1 = await fetchAllAdAccounts(API_URL, TOKEN1!, "BM1");
    const resToken2 = await fetchAllAdAccounts(API_URL, TOKEN2!, "BM2");

    // Opção A ‒ guardar tudo separado
    const result = { token1: resToken1, token2: resToken2 };
    if (!result) {
      throw new Error("Nenhum resultado retornado da sincronização.");
    }

    res
      .status(200)
      .json({ message: "✅ Sincronização concluída com sucesso.", result });
  } catch (error: any) {
    console.error("❌ Erro na sincronização:", error);
    res
      .status(500)
      .json({ error: error.message || "Erro ao iniciar a sincronização" });
  }
});

// Sincronização manual de uma conta específica
app.get("/sync-ads/:ad_account_id", async (req, res) => {
  const { ad_account_id } = req.params;
  console.log(`🖥️ Rota /sync-ads/${ad_account_id} acionada!`);

  if (!ad_account_id || typeof ad_account_id !== "string") {
    return res
      .status(400)
      .json({ error: "ID da conta de anúncio inválido ou não fornecido." });
  }

  try {
    await fetchAdAccountsByIds([ad_account_id], TOKEN1!, "BM1"),
      await fetchAdAccountsByIds([ad_account_id], TOKEN2!, "BM2"),
      res.status(200).json({
        message: `✅ Sincronização da conta ${ad_account_id} concluída com sucesso.`,
      });
  } catch (error: any) {
    console.error(`❌ Erro ao sincronizar a conta ${ad_account_id}:`, error);
    res.status(500).json({
      error: error.message || "Erro ao sincronizar a conta de anúncio.",
    });
  }
});

// Sincronização manual de múltiplas contas
app.post("/sync-ads-by-ids", async (req, res) => {
  const { account_ids } = req.body;

  console.log("🖥️ Rota /sync-ads-by-ids acionada com:", account_ids);

  if (!Array.isArray(account_ids) || account_ids.length === 0) {
    return res
      .status(400)
      .json({ error: "É necessário fornecer um array de IDs de contas." });
  }

  const cleanIds = account_ids.map((id: string) =>
    id.startsWith("act_") ? id.replace("act_", "") : id
  );

  try {
    await fetchAdAccountsByIds(cleanIds, TOKEN1!, "BM1"),
      await fetchAdAccountsByIds(cleanIds, TOKEN2!, "BM2");

    res.status(200).json({
      message: "✅ Sincronização das contas concluída com sucesso.",
      synchronized_accounts: cleanIds,
    });
  } catch (error: any) {
    console.error("❌ Erro na sincronização de contas específicas:", error);
    res.status(500).json({
      error: error.message || "Erro ao sincronizar as contas.",
    });
  }
});

// Tarefa automática a cada 15 minutos
// cron.schedule("*/15 * * * *", async () => {
//   console.log("🔁 Executando sincronização das contas (15min)...");
//   try {
//     // await fetchAllAdAccounts(API_URL);
//     registrarExecucao();
//   } catch (error) {
//     console.error("❌ Erro na sincronização das contas:", error);
//   }
// });

// Tarefa automática a cada 29 minutos
// cron.schedule("*/29 * * * *", async () => {
//   console.log("⏱️ Executando ajuste de limites (30min)...");
//   try {
//     await autoDisparoAlertas();
//   } catch (error) {
//     console.error("❌ Erro no ajuste de limites:", error);
//   }
// });

cron.schedule("0 9 * * *", async () => {
  console.log("☀️ Executando tarefa diária às 9h...");

  // await Promise.all([
  //   ajusteDiarioLimitesAlerta(TOKEN1!),
  //   ajusteDiarioLimitesAlerta(TOKEN2!),
  // ]);
});

cron.schedule('0 0 * * *', async () => {
  try {
    if (TOKEN1 && TOKEN2) {
      await recalcularGastosDiarios(TOKEN1, TOKEN2);
      console.log("🔁 Recalculo de gastos diário executado com sucesso.");
    } else {
      console.warn("⚠️ Tokens de acesso não encontrados no .env.");
    }
  } catch (error) {
    console.error("❌ Erro ao recalcular gastos no cron:", error);
  }
});

// Execução ao iniciar o app
(async () => {
  console.log("🚀 API Scripts Meta iniciada");

  registrarExecucao();

})();

export { app as metaSync };
