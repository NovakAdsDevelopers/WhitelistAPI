import express from "express";
import cors from "cors";
import cron from "node-cron";
import dotenv from "dotenv";

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

// Configurações iniciais
dotenv.config();
const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

const API_URL = `${process.env.META_MARKETING_API_URL}/me/adaccounts`;
const CLIENT_ID = `${process.env.FB_CLIENT_ID_1}`;
const APP_SECRET = `${process.env.FB_CLIENT_SECRET_1}`;

const tokens = prisma.token.findMany();

// Tempo restante para próxima execução
app.get("/tempo-restante-sync", (req, res) => {
  const restanteMs = tempoRestanteMs();
  const minutos = Math.floor(restanteMs / 60000);
  const segundos = Math.floor((restanteMs % 60000) / 1000);
  res.json({ minutos, segundos, totalMs: restanteMs });
});

// Rota manual para sincronização geral
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
    res.status(200).json({
      message: "✅ Sincronização concluída.",
      result: results,
    });
  } catch (error: any) {
    console.error("❌ Erro na sincronização:", error);
    res.status(500).json({ error: error.message || "Erro na sincronização." });
  }
});

// Rota para sincronização de conta individual
app.get("/sync-ads/:ad_account_id", async (req, res) => {
  const { ad_account_id } = req.params;
  if (!ad_account_id) {
    return res.status(400).json({ error: "ID inválido." });
  }

  try {
    console.log(
      `🔄 Sincronizando conta ${ad_account_id} para todos os tokens...`
    );

    await fetchAdAccountsByIds([ad_account_id]);

    console.log(`✅ Conta ${ad_account_id} sincronizada com sucesso.`);
    res.status(200).json({
      message: `✅ Conta ${ad_account_id} sincronizada.`,
    });
  } catch (error: any) {
    console.error(`❌ Erro na conta ${ad_account_id}:`, error);
    res.status(500).json({ error: error.message || "Erro na sincronização." });
  }
});

// Rota para sincronizar múltiplas contas
app.post("/sync-ads-by-ids", async (req, res) => {
  const { account_ids } = req.body;
  if (!Array.isArray(account_ids) || !account_ids.length) {
    return res.status(400).json({ error: "IDs inválidos." });
  }

  const cleanIds = account_ids.map((id: string) => id.replace(/^act_/, ""));

  try {
    await Promise.all([fetchAdAccountsByIds(cleanIds)]);
    res.status(200).json({
      message: "✅ Contas sincronizadas.",
      synchronized_accounts: cleanIds,
    });
  } catch (error: any) {
    console.error("❌ Erro ao sincronizar contas:", error);
    res.status(500).json({ error: error.message || "Erro na sincronização." });
  }
});

app.post("/sync-bms", async (req, res) => {
  try {
    (await tokens).map(async (token) => {
      createORupdateBMs(token.token, token.id);
    });
    res.status(200).json({
      message: "✅ BMs sincronizadas.",
    });
  } catch (error: any) {
    console.error("❌ Erro ao sincronizar BMs:", error);
    res.status(500).json({ error: error.message || "Erro na sincronização." });
  }
});

// Cron para atualizar tokens no primeiro dia do mês às 00:00
cron.schedule("0 0 1 * *", async () => {
  console.log("🔄 CRON: Atualizando tokens do Meta no início do mês...");

  try {
    const tokens = await prisma.token.findMany();
    console.log(`🔹 Encontrados ${tokens.length} tokens`);

    for (const token of tokens) {
      console.log(`🔄 Renovando token para: ${token.title}`);
      await fetchFacebookToken(token.client_id, token.secret_id, token.title);
    }

    console.log("✅ Todos os tokens atualizados com sucesso no início do mês");
  } catch (error) {
    console.error("❌ CRON erro ao atualizar tokens do Meta:", error);
  }
});

// CRON: Sincronização de contas a cada 30 minutos
cron.schedule("*/50 * * * *", async () => {
  console.log("🔄 CRON: Sincronizando contas de 30 em 30 minutos...");

  try {
    const tokens = await prisma.token.findMany();
    console.log(`🔹 Encontrados ${tokens.length} tokens`);

    for (const token of tokens) {
      console.log(`🔄 Sincronizando contas para: ${token.title}`);
      await fetchAllAdAccounts(token.token);
    }

    registrarExecucao();
    console.log("✅ Todas as contas foram atualizadas com sucesso");
  } catch (error) {
    console.error("❌ CRON erro ao sincronizar contas:", error);
  }
});

// CRON: Ajuste de alertas a cada 30 minutos
cron.schedule("*/30 * * * *", async () => {
  try {
    console.log("⚠️ CRON: Disparando alertas automáticos...");
    await autoDisparoAlertas();
  } catch (error) {
    console.error("❌ CRON erro ao disparar alertas:", error);
  }
});

// CRON: Tarefa às 9h para ajustes diários
cron.schedule("0 9 * * *", async () => {
  console.log("☀️ CRON: Ajuste de limites diários...");
  try {
    await Promise.all([ajusteDiarioLimitesAlerta()]);
  } catch (error) {
    console.error("❌ CRON erro no ajuste de limites:", error);
  }
});

// CRON: Verifica, Cria ou atualiza BMs todo dia 3 à meia-noite
cron.schedule("0 0 3 * *", async () => {
  console.log("🕛 Iniciando atualização de BMs no dia 3 à meia-noite...");

  try {
    const tokensList = await tokens; // sua função que retorna os tokens

    for (const token of tokensList) {
      console.log(`🔹 Token carregado para: ${token.title}`);
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

    // Busca todas as BMs
    const allBMs = await prisma.bM.findMany({
      include: { token: true }, // assumindo que cada BM tem um relacionamento com o token
    });

    for (const bm of allBMs) {
      const BMId = bm.BMId;
      const token = bm.token?.token; // pega o token associado à BM

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

type NaoAssociadaGlobal = { id: string; name: string; BMId: string };

(async () => {
  console.log('🚀 Meta API Scheduler iniciada');

  // ⬇️ coletor global fora do laço
  const naoAssociadasGlobal: NaoAssociadaGlobal[] = [];

  try {
    // // Busca todas as BMs
    // const allBMs = await prisma.bM.findMany({
    //   include: { token: true },
    // });

    // for (const bm of allBMs) {
    //   const BMId = bm.BMId;
    //   const token = bm.token?.token;

    //   if (!token) {
    //     console.warn(`⚠️ BM ${BMId} não possui token associado. Ignorando.`);
    //     continue;
    //   }

    //   console.log(`🔹 Associando BM ${BMId} com seu token.`);
    //   const { naoAssociadas } = await associateBMsTOAdAccounts(BMId, token);

    //   // acumula no global com a BM de origem
    //   for (const acc of naoAssociadas) {
    //     naoAssociadasGlobal.push({ id: acc.id, name: acc.name, BMId });
    //   }
    // }

    // // ✅ Deduplicar por id e agregar BMs onde apareceu
    // const dedupMap = new Map<
    //   string,
    //   { id: string; name: string; bmIds: Set<string> }
    // >();

    // for (const acc of naoAssociadasGlobal) {
    //   const found = dedupMap.get(acc.id);
    //   if (found) {
    //     found.bmIds.add(acc.BMId);
    //   } else {
    //     dedupMap.set(acc.id, { id: acc.id, name: acc.name, bmIds: new Set([acc.BMId]) });
    //   }
    // }

    // const naoAssociadasUnicas = Array.from(dedupMap.values()).map((x) => ({
    //   id: x.id,
    //   name: x.name,
    //   bms: Array.from(x.bmIds).join(', '), // útil para diagnosticar
    // }));

    // // 📊 Relatório final
    // console.log('🏁 FIM — Relatório de contas NÃO associadas');
    // console.log(`• Total BMs: ${allBMs.length}`);
    // console.log(`• Não associadas (com duplicatas): ${naoAssociadasGlobal.length}`);
    // console.log(`• Não associadas (únicas por id): ${naoAssociadasUnicas.length}`);
    // console.table(naoAssociadasUnicas);
  } catch (error) {
    console.error('❌ CRON erro ao recalcular gastos:', error);
  }
})();

export { app as metaSync };
