import express, { Application } from "express";
import cron from "node-cron";
import axios from "axios";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import cors from "cors";

dotenv.config();

const app = express();
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
const prisma = new PrismaClient();
const token = process.env.TOKEN_ACCESS_META;
const API_URL = `${process.env.META_MARKETING_API_URL}/me/adaccounts`;

async function saveOrUpdateAdAccounts(adAccounts: any[]) {
  console.log(`🔹 Processando ${adAccounts.length} contas recebidas...`);

  for (const account of adAccounts) {
    console.log(
      `🔍 Verificando conta: ${account.account_id} - ${account.name}`
    );

    try {
      const existingAccount = await prisma.adAccount.findUnique({
        where: { id: account.account_id },
      });

      const amountSpentDecimal = new Decimal(account.amount_spent || "0");
      const agora = new Date().toISOString();

      if (existingAccount) {
        const hasChanges =
          existingAccount.nome !== account.name ||
          existingAccount.status !== account.account_status ||
          existingAccount.moeda !== account.currency ||
          existingAccount.fusoHorario !== account.timezone_name ||
          existingAccount.limiteGasto !== account.spend_cap ||
          existingAccount.saldoMeta !== account.balance ||
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
              limiteGasto: account.spend_cap,
              saldoMeta: account.balance,
              ultimaSincronizacao: agora,
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
            gastoAPI: account.amount_spent,
            limiteGasto: account.spend_cap,
            saldoMeta: account.balance,
            ultimaSincronizacao: agora,
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
            "name,account_id,account_status,currency,timezone_name,amount_spent,spend_cap,balance",
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

    console.log(
      `✅ Sincronização concluída. Total de contas processadas: ${totalAccounts}`
    );
    return { totalAccounts }; // ← aqui
  } catch (error) {
    console.error("❌ Erro ao buscar contas de anúncio:", error);
    throw error; // ← aqui
  }
}

async function fetchAdAccountsByIds(accountIds: string[]) {
  console.log(`🔍 Iniciando sincronização de contas específicas:`, accountIds);

  const results: any[] = [];

  for (const accountId of accountIds) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v17.0/act_${accountId}`,
        {
          params: {
            access_token: token,
            fields:
              "name,account_id,account_status,currency,timezone_name,amount_spent,spend_cap,balance",
          },
        }
      );

      if (response.data) {
        results.push({
          ...response.data,
          account_id: accountId,
        });
        console.log(`✅ Conta ${accountId} carregada com sucesso.`);
      }
    } catch (error) {
      console.error(`❌ Erro ao buscar conta ${accountId}:`, error);
    }
  }

  if (results.length > 0) {
    await saveOrUpdateAdAccounts(results);
  } else {
    console.log("⚠️ Nenhuma conta válida encontrada para atualizar.");
  }
}

// Sincronização geral manual
app.get("/sync-ads", async (req, res) => {
  console.log("🖥️ Rota /sync-ads acionada!");
  try {
    const result: any = await fetchAllAdAccounts(API_URL); // deve lançar erro se falhar
    console.log("🔁 Resultado da sincronização:", result);

    // Protege contra retorno undefined/null
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
    await fetchAdAccountsByIds([ad_account_id]); // usa sua função atual
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

// Sincronização manual de contas especificas

app.post("/sync-ads-by-ids", async (req, res) => {
  const { account_ids } = req.body;

  console.log("🖥️ Rota /sync-ads-by-ids acionada com:", account_ids);

  if (!Array.isArray(account_ids) || account_ids.length === 0) {
    return res
      .status(400)
      .json({ error: "É necessário fornecer um array de IDs de contas." });
  }

  // Remove "act_" caso os IDs venham com o prefixo
  const cleanIds = account_ids.map((id: string) =>
    id.startsWith("act_") ? id.replace("act_", "") : id
  );

  try {
    await fetchAdAccountsByIds(cleanIds);
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

// Busca e salva gasto diário dos últimos 7 dias
async function fetchAdAccountDailySpend(accountId: string) {
  const today = new Date().toISOString().split("T")[0]; // formato: "YYYY-MM-DD"

  let url = `https://graph.facebook.com/v22.0/act_${accountId}/insights?access_token=${token}&fields=spend,date_start&time_increment=1&time_range={"since":"2023-01-01","until":"${today}"}`;

  try {
    let hasNextPage = true;
    let page = 1;

    while (hasNextPage) {
      console.log(`📄 Buscando página ${page} de gastos para conta ${accountId}...`);

      const response = await axios.get(url);

      const insights = response.data?.data;
      if (!insights || insights.length === 0) break;

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
            gasto: spend.toString(),
          },
          create: {
            contaAnuncioId: accountId,
            data: date,
            gasto: spend.toString(),
          },
        });

        console.log(`💾 Gasto de ${spend} salvo para ${accountId} em ${day.date_start}`);
      }

      if (response.data?.paging?.next) {
        url = response.data.paging.next;
        page++;
      } else {
        hasNextPage = false;
      }
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

    const total = Math.floor(totalGasto._sum.gasto ?? 0).toString();

    await prisma.adAccount.update({
      where: { id: accountId },
      data: {
        gastoTotal: total,
      },
    });

    console.log(`💰 Gasto total atualizado: ${total}`);
  } catch (error) {
    console.error(`❌ Erro ao buscar gasto diário da conta ${accountId}:`, error);
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

async function getInsights(
  accountId: string,
  startDate?: string,
  endDate?: string
) {
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
    console.error(
      `❌ Erro ao obter insights da conta ${accountId}:`,
      error || error
    );
    return [];
  }
}

// Sincronização automática: Contas + Gastos diários a cada 8 horas
cron.schedule("0 */8 * * *", async () => {
  console.log("⏳ Executando sincronização automática...");
  // await fetchAllAdAccounts(API_URL);
  // await fetchDailySpendForAllAccounts();
});

// Execução ao iniciar
(async () => {
  console.log("🚀 Sincronização inicial ao iniciar a API...");
  // await fetchAllAdAccounts(API_URL);
  // await fetchDailySpendForAllAccounts();
})();

export { app as metaSync };
