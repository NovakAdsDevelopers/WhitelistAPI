import express from "express";
import cron from "node-cron";
import axios from "axios";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const token = process.env.TOKEN_ACCESS_META;
const API_URL = `${process.env.META_MARKETING_API_URL}/me/adaccounts`;

// Função para buscar e salvar contas de anúncio
async function saveOrUpdateAdAccounts(adAccounts: any[]) {
  console.log(`🔹 Processando ${adAccounts.length} contas recebidas...`);

  for (const account of adAccounts) {
    console.log(`🔍 Verificando conta: ${account.account_id} - ${account.name}`);

    try {
      const existingAccount = await prisma.adAccount.findUnique({
        where: { id: account.account_id },
      });

      const amountSpentDecimal = new Decimal(account.amount_spent || "0");

      if (existingAccount) {
        const hasChanges =
          existingAccount.nome !== account.name ||
          existingAccount.status !== account.account_status ||
          existingAccount.moeda !== account.currency ||
          existingAccount.fusoHorario !== account.timezone_name ||
          !existingAccount.gastoTotal.equals(amountSpentDecimal);

        if (hasChanges) {
          console.log(`📝 Atualizando conta ${account.account_id}...`);
          await prisma.adAccount.update({
            where: { id: account.account_id },
            data: {
              nome: account.name,
              status: account.account_status,
              moeda: account.currency,
              fusoHorario: account.timezone_name,
              gastoTotal: amountSpentDecimal,
            },
          });
          console.log(`✅ Conta ${account.account_id} atualizada com sucesso.`);
        } else {
          console.log(`✅ Conta ${account.account_id} já está atualizada.`);
        }
      } else {
        console.log(`🆕 Criando nova conta ${account.account_id}...`);
        await prisma.adAccount.create({
          data: {
            id: account.account_id,
            nome: account.name,
            status: account.account_status,
            moeda: account.currency,
            fusoHorario: account.timezone_name,
            gastoTotal: amountSpentDecimal,
            gastoAPI: account.amount_spent
          },
        });
        console.log(`✅ Conta ${account.account_id} cadastrada com sucesso.`);
      }
    } catch (error) {
      console.error(`❌ Erro ao processar conta ${account.account_id}:`, error);
    }
  }
}

// Busca contas com paginação
async function fetchAllAdAccounts(url: string) {
  console.log("🔄 Iniciando busca de contas de anúncio no Meta API...");
  try {
    let nextUrl: string | null = url;
    let totalAccounts = 0;

    while (nextUrl) {
      console.log(`📡 Fazendo requisição para: ${nextUrl}`);
      const response: any = await axios.get(nextUrl, {
        params: {
          access_token: token,
          fields:
            "name,account_id,account_status,currency,timezone_name,amount_spent",
          limit: 25,
        },
      });

      const data = response.data;
      if (data.data && data.data.length > 0) {
        totalAccounts += data.data.length;
        await saveOrUpdateAdAccounts(data.data);
      }

      nextUrl = data.paging?.next || null;
    }

    console.log(`✅ Sincronização concluída. Total de contas processadas: ${totalAccounts}`);
  } catch (error) {
    console.error("❌ Erro ao buscar contas de anúncio:", error);
  }
}

// Sincronização manual
app.get("/sync-ads", async (req, res) => {
  console.log("🖥️ Rota /sync-ads acionada!");
  try {
    await fetchAllAdAccounts(API_URL);
    res.json({ message: "✅ Sincronização iniciada com sucesso." });
  } catch (error) {
    res.status(500).json({ error: "Erro ao iniciar a sincronização" });
  }
});

// Busca e salva gasto diário dos últimos 7 dias
async function fetchAdAccountDailySpend(accountId: string) {
  const url = `https://graph.facebook.com/v22.0/act_${accountId}/insights?access_token=${token}&fields=spend,date_start&time_increment=1&time_range={"since":"2023-01-01","until":"2025-12-31"}`
 
  try {
    const response = await axios.get(url, {
      params: {
        access_token: token,
        time_increment: 1,
        date_preset: "last_7d",
        fields: "spend,date_start",
      },
    });

    const insights = response.data?.data;
    if (!insights || insights.length === 0) return;

    for (const day of insights) {
      const date = new Date(day.date_start);
      const spend = parseFloat(day.spend || "0");

      await prisma.gastoDiario.upsert({
        where: {
          contaAnuncioId_data: {
            contaAnuncioId: accountId,
            data: date,
          },
        },
        update: {
          gasto: new Decimal(spend),
        },
        create: {
          contaAnuncioId: accountId,
          data: date,
          gasto: new Decimal(spend),
        },
      });

      console.log(`💾 Gasto de ${spend} salvo para ${accountId} em ${day.date_start}`);
    }

    // Soma de todos os gastos para atualizar gastoTotal
    console.log(`📊 Recalculando gasto total para a conta ${accountId}...`);
    const totalGasto = await prisma.gastoDiario.aggregate({
      _sum: {
        gasto: true,
      },
      where: {
        contaAnuncioId: accountId,
      },
    });

    await prisma.adAccount.update({
      where: { id: accountId },
      data: {
        gastoTotal: totalGasto._sum.gasto || new Decimal(0),
      },
    });

    console.log(`💰 Gasto total atualizado: ${totalGasto._sum.gasto}`);
  } catch (error) {
    console.error(`❌ Erro ao buscar gasto diário da conta ${accountId}:`, error || error);
  }
}

// Executa sincronização diária para todas as contas
async function fetchDailySpendForAllAccounts() {
  const accounts = await prisma.adAccount.findMany();
  for (const acc of accounts) {
    await fetchAdAccountDailySpend(acc.id);
  }
}

// Rota manual para sincronizar gasto diário
app.get("/sync-daily-spend", async (req, res) => {
  try {
    await fetchDailySpendForAllAccounts();
    res.json({ message: "✅ Gastos diários sincronizados com sucesso." });
  } catch (error) {
    res.status(500).json({ error: "Erro ao sincronizar gastos diários." });
  }
});

async function getInsights(accountId: string, startDate?: string, endDate?: string) {
  const url = `https://graph.facebook.com/v17.0/act_${accountId}/insights`;

  const params: any = {
    access_token: token,
    fields: "spend,date_start",
    time_increment: 1,
    limit: 25,
  };

  if (startDate && endDate) {
    params.time_range = JSON.stringify({
      since: startDate,
      until: endDate,
    });
  } else {
    params.date_preset = "maximum";
  }

  try {
    const response = await axios.get(url, { params });

    const insights = response.data;

    if (!insights || insights.length === 0) {
      console.log(`⚠️ Nenhum insight encontrado para a conta ${accountId}`);
      return [];
    }

    console.log(`📈 Insights obtidos para a conta ${accountId}:`, insights);
    return insights;
  } catch (error) {
    console.error(`❌ Erro ao obter insights da conta ${accountId}:`, error || error);
    return [];
  }
}

// Sincronização automática: Contas + Gastos diários a cada 8 horas
cron.schedule("0 */8 * * *", async () => {
  console.log("⏳ Executando sincronização automática...");
  await fetchAllAdAccounts(API_URL);
  // await fetchDailySpendForAllAccounts();
});

// Execução ao iniciar
(async () => {
  console.log("🚀 Sincronização inicial ao iniciar a API...");
  //  await fetchAllAdAccounts(API_URL);
  // await fetchDailySpendForAllAccounts();
})();

export { app as metaSync };
