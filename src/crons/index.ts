// src/crons/index.ts
import cron from "node-cron";

type Deps = {
  prisma: any;
  fetchFacebookToken: (clientId: string, secretId: string, title: string) => Promise<void>;
  fetchAllAdAccounts: (token: string) => Promise<void>;
  registrarExecucao: () => Promise<void>;
  autoDisparoAlertas: () => Promise<void>;
  ajusteDiarioLimitesAlerta: () => Promise<void>;
  tokens: () => Promise<Array<{ id: string | number; title: string; token: string }>>;
  createORupdateBMs: (token: string, id: string | number) => Promise<void>;
  recalcularGastosDiarios: () => Promise<void>;
  associateBMsTOAdAccounts: (bmId: string, token: string) => Promise<void>;
  fetchTokensFromPrisma?: () => Promise<Array<{ title: string; client_id: string; secret_id: string }>>; // opcional
};

const TZ = "America/Sao_Paulo";

declare global {
  // Evita CRON duplicado em dev / hot reload
  // eslint-disable-next-line no-var
  var __CRON_STARTED__: boolean | undefined;
}

export function setupCrons(deps: Deps) {
  if (global.__CRON_STARTED__) {
    console.log("⏱️ CRONs já iniciados — ignorando nova inicialização.");
    return;
  }
  global.__CRON_STARTED__ = true;

  const {
    prisma,
    fetchFacebookToken,
    fetchAllAdAccounts,
    registrarExecucao,
    autoDisparoAlertas,
    ajusteDiarioLimitesAlerta,
    tokens,
    createORupdateBMs,
    recalcularGastosDiarios,
    associateBMsTOAdAccounts,
  } = deps;

  // 1) Atualizar tokens no dia 1 às 00:00
  cron.schedule("0 0 1 * *", async () => {
    console.log("🔄 CRON: Atualizando tokens do Meta no início do mês...");
    try {
      // Se você já usa prisma.token.findMany():
      const tokensDb = await prisma.token.findMany(); // ou use deps.fetchTokensFromPrisma?.()
      console.log(`🔹 Encontrados ${tokensDb.length} tokens`);

      for (const token of tokensDb) {
        console.log(`🔄 Renovando token para: ${token.title}`);
        // Ajuste parâmetros conforme sua função
        await fetchFacebookToken(token.client_id, token.secret_id, token.title);
      }

      console.log("✅ Todos os tokens atualizados com sucesso no início do mês");
    } catch (error) {
      console.error("❌ CRON erro ao atualizar tokens do Meta:", error);
    }
  }, { timezone: TZ });

  // 2) Sincronização de contas a cada 30 minutos
  // OBS: seu comentário dizia "30 minutos", mas a expressão estava "*/50".
  cron.schedule("*/30 * * * *", async () => {
    console.log("🔄 CRON: Sincronizando contas de 30 em 30 minutos...");
    try {
      const tokensDb = await prisma.token.findMany();
      console.log(`🔹 Encontrados ${tokensDb.length} tokens`);

      for (const token of tokensDb) {
        console.log(`🔄 Sincronizando contas para: ${token.title}`);
        await fetchAllAdAccounts(token.token);
      }

      await registrarExecucao();
      console.log("✅ Todas as contas foram atualizadas com sucesso");
    } catch (error) {
      console.error("❌ CRON erro ao sincronizar contas:", error);
    }
  }, { timezone: TZ });

  // 3) Ajuste de alertas a cada 30 minutos
  cron.schedule("*/30 * * * *", async () => {
    try {
      console.log("⚠️ CRON: Disparando alertas automáticos...");
      await autoDisparoAlertas();
    } catch (error) {
      console.error("❌ CRON erro ao disparar alertas:", error);
    }
  }, { timezone: TZ });

  // 4) Tarefa às 9h para ajustes diários
  cron.schedule("0 9 * * *", async () => {
    console.log("☀️ CRON: Ajuste de limites diários...");
    try {
      await Promise.all([ajusteDiarioLimitesAlerta()]);
    } catch (error) {
      console.error("❌ CRON erro no ajuste de limites:", error);
    }
  }, { timezone: TZ });

  // 5) Verificar/Atualizar BMs todo dia 3 à meia-noite
  cron.schedule("0 0 3 * *", async () => {
    console.log("🕛 Iniciando atualização de BMs no dia 3 à meia-noite...");
    try {
      const tokensList = await tokens(); // sua função que retorna os tokens
      for (const token of tokensList) {
        console.log(`🔹 Token carregado para: ${token.title}`);
        await createORupdateBMs(token.token, token.id);
      }
      console.log("✅ Todas as BMs foram atualizadas com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao atualizar BMs:", error);
    }
  }, { timezone: TZ });

  // 6) Recalcular gastos diariamente às 0h + associar BMs às AdAccounts
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
  }, { timezone: TZ });

  console.log("✅ CRONs registrados com sucesso.");
}
