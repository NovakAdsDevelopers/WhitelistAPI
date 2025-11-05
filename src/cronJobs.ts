// src/automations/cronJobs.ts
import cron from "node-cron";
import { prisma } from "./database";
import {
  associateBMsTOAdAccounts,
  createORupdateBMs,
} from "./meta/services/BusinessManager";
import { recalcularGastosDiarios } from "./meta/services/gastoDiario";
import { fetchAllAdAccounts } from "./meta/services/AdAccounts";
import { fetchFacebookToken } from "./meta/services/Token";
import { consultarExtratoJob, salvarExtratoJob } from "./inter/extrato-service";
import { ajusteDiarioLimitesAlerta, autoDisparoAlertas } from "./meta/services/limite";

// Se você tiver funções auxiliares importadas de outros módulos
// como "autoDisparoAlertas" ou "ajusteDiarioLimitesAlerta", importe-as aqui.
let isSyncRunning = false;
const TZ = "America/Sao_Paulo";

export function startCronJobs() {
  console.log("🕓 Iniciando automações CRON...");

  // CRON: Atualizações de gasto de contas a cada 30 minutos
  cron.schedule("*/30 * * * *", async () => {
    if (isSyncRunning) {
      console.warn(
        "⏳ CRON: Sincronização já em andamento. Ignorando nova execução."
      );
      return;
    }

    isSyncRunning = true;
    const startTime = new Date();
    console.log("🔄 [CRON] Iniciando sincronização geral das contas...");

    try {
      const tokens = await prisma.token.findMany();
      console.log(`🔹 [CRON] ${tokens.length} tokens encontrados.`);

      const results: Record<string, any> = {};

      for (const token of tokens) {
        try {
          console.log(`🔄 [CRON] Sincronizando contas para: ${token.title}`);
          results[token.title] = await fetchAllAdAccounts(token.token);
        } catch (err) {
          console.error(`❌ [CRON] Falha ao sincronizar ${token.title}:`, err);
        }
      }

      console.log("✅ [CRON] Sincronização de contas concluída com sucesso.");
    } catch (error: any) {
      console.error(
        "❌ [CRON] Erro na sincronização geral:",
        error.message || error
      );
    } finally {
      isSyncRunning = false;
      const duration = ((Date.now() - startTime.getTime()) / 1000).toFixed(1);
      console.log(`🕒 [CRON] Execução finalizada (${duration}s).`);
    }
  });

  // CRON: Ajuste de alertas a cada 30 minutos
  //  cron.schedule("*/30 * * * *", async () => {
  //    try {
  //      console.log("⚠️ CRON: Disparando alertas automáticos...");
  //      await autoDisparoAlertas();
  //    } catch (error) {
  //      console.error("❌ CRON erro ao disparar alertas:", error);
  //    }
  //  });

  // CRON: Tarefa às 9h para ajustes diários
  // cron.schedule("0 9 * * *", async () => {
  //   console.log("☀️ CRON: Ajuste de limites diários...");
  //   try {
  //     await Promise.all([ajusteDiarioLimitesAlerta()]);
  //   } catch (error) {
  //     console.error("❌ CRON erro no ajuste de limites:", error);
  //   }
  // });

  // 1) Atualizar tokens no dia 1 às 00:00
  cron.schedule(
    "0 0 1 * *",
    async () => {
      console.log("🔄 CRON: Atualizando tokens do Meta no início do mês...");
      try {
        // Se você já usa prisma.token.findMany():
        const tokensDb = await prisma.token.findMany(); // ou use deps.fetchTokensFromPrisma?.()
        console.log(`🔹 Encontrados ${tokensDb.length} tokens`);

        for (const token of tokensDb) {
          console.log(`🔄 Renovando token para: ${token.title}`);
          // Ajuste parâmetros conforme sua função
          await fetchFacebookToken(
            token.client_id,
            token.secret_id,
            token.title
          );
        }

        console.log(
          "✅ Todos os tokens atualizados com sucesso no início do mês"
        );
      } catch (error) {
        console.error("❌ CRON erro ao atualizar tokens do Meta:", error);
      }
    },
    { timezone: TZ }
  );

  // CRON: Verifica, cria ou atualiza BMs todo dia 3 à meia-noite
  cron.schedule("0 0 3 * *", async () => {
    console.log("🕛 Iniciando atualização de BMs no dia 3 à meia-noite...");
    try {
      const tokensList = await prisma.token.findMany();

      for (const token of tokensList) {
        console.log(`🔹 Atualizando BM do token: ${token.title}`);
        await createORupdateBMs(token.token, token.id);
      }

      console.log("✅ Todas as BMs foram atualizadas com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao atualizar BMs:", error);
    }
  });

  // CRON: Recalcular gastos diariamente às 0h
  cron.schedule("0 0 * * *", async () => {
    try {
      await recalcularGastosDiarios();
      console.log("📊 CRON: Recalculo de gastos concluído.");

      const allBMs = await prisma.bM.findMany({
        include: { token: true },
      });

      for (const bm of allBMs) {
        const BMId = bm.BMId;
        const token = bm.token?.token;

        if (!token) {
          console.warn(`⚠️ BM ${BMId} não possui token associado. Ignorando.`);
          continue;
        }

        console.log(`🔹 Associando BM ${BMId} com seu token.`);
        await associateBMsTOAdAccounts(BMId, token);
      }
    } catch (error) {
      console.error("❌ CRON erro ao recalcular gastos:", error);
    }
  });

  function dataHojeISO(): string {
    const hoje = new Date();
    return hoje.toISOString().split("T")[0]; // YYYY-MM-DD
  }

  // 🕐 Executa a cada 1 hora (no minuto 0)
  cron.schedule("0 * * * *", async () => {
    const hoje = dataHojeISO();
    console.log(`⏰ [CRON] Executando job de extrato para ${hoje}`);
    try {
      await salvarExtratoJob(hoje);
    } catch (error: any) {
      console.error("❌ [CRON] Erro ao rodar o job:", error.message);
    }
  });
}
