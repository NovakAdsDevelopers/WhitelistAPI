import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../database";
import axios from "axios";
import { saveOrUpdateAdAccounts } from "./Account";

// Busca contas com paginação
export async function fetchAllAdAccounts(token: string) {
  console.log("🔄 Iniciando busca de contas de anúncio no Meta API...");
  try {
    let nextUrl: string | null = `https://graph.facebook.com/v23.0/me/adaccounts`;
    let totalAccounts = 0;
    let isFirstPage = true;

    while (nextUrl) {
      console.log(`📡 Fazendo requisição para: ${nextUrl}`);

      let response;

      if (isFirstPage) {
        response = await axios.get(nextUrl, {
          params: {
            access_token: token,
            fields:
              "name,account_id,account_status,currency,timezone_name,amount_spent,spend_cap,balance",
            limit: 25,
          },
        });
        isFirstPage = false;
      } else {
        response = await axios.get(nextUrl);
      }

      const data: any = response.data;

      if (data.error) {
        throw new Error(
          `Erro da API do Facebook: ${data.error.message} (code ${data.error.code})`
        );
      }

      if (Array.isArray(data.data) && data.data.length > 0) {
        totalAccounts += data.data.length;
        await saveOrUpdateAdAccounts(data.data, token);
      }

      nextUrl = data.paging?.next || null;
    }

    console.log(
      `✅ Sincronização concluída. Total de contas processadas: ${totalAccounts}`
    );
    return { totalAccounts };
  } catch (error) {
    console.error("❌ Erro ao buscar contas de anúncio:", error);
    throw error;
  }
}


export async function  fetchAdAccountsByIds(accountIds: string[]) {
  console.log(`🔍 Iniciando sincronização de contas específicas:`, accountIds);

  const results: any[] = [];

  for (const accountId of accountIds) {
    try {
      // 1️⃣ Descobrir a BM associada à conta
      const adAccount = await prisma.adAccount.findUnique({
        where: { id: accountId },
        include: {
          BM: {
            include: { token: true }, // pega o token associado
          },
        },
      });

      if (!adAccount || !adAccount.BM || !adAccount.BM.token) {
        console.warn(
          `⚠️ Conta ${accountId} não está associada a nenhuma BM/token.`
        );
        continue;
      }

      const token = adAccount.BM.token.token; // pega o token correto
      console.log(
        `🔑 Usando token da BM (${adAccount.BM.nome}) para conta ${accountId}`
      );

      // 2️⃣ Chamar a API do Meta com o token correto
      const response = await axios.get(
        `https://graph.facebook.com/v23.0/act_${accountId}`,
        {
          params: {
            access_token: token,
            fields:
              "name,account_id,account_status,currency,timezone_name,amount_spent,spend_cap,balance",
          },
        }
      );
      // 3️⃣ Montar resultado
      if (response.data) {
        console.log(`🔹 Dados recebidos para conta ${accountId}:`, response.data);
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

  // 4️⃣ Salvar/atualizar no banco
  if (results.length > 0) {
    // aqui pode ser que cada conta use um token diferente, então talvez precise salvar uma a uma
    for (const account of results) {
      const adAccount = await prisma.adAccount.findUnique({
        where: { id: account.account_id },
        include: { BM: { include: { token: true } } },
      });

      if (adAccount?.BM?.token) {
        await saveOrUpdateAdAccounts([account], adAccount.BM.token.token);
      }
    }
  } else {
    console.log("⚠️ Nenhuma conta válida encontrada para atualizar.");
  }
}
// Busca e salva gasto diário dos últimos 7 dias
export async function fetchAdAccountDailySpend(
  accountId: string,
  token: string,
  since?: string
) {
  console.log("Esse é o valor do since:" + since);
  const today = new Date().toISOString().split("T")[0];
  const startDate = since
    ? new Date(since).toISOString().split("T")[0]
    : "2024-06-01";

  console.log(startDate);

  const timeRange = encodeURIComponent(
    JSON.stringify({ since: startDate, until: today })
  );

  let url = `https://graph.facebook.com/v23.0/act_${accountId}/insights?access_token=${token}&fields=spend,date_start&time_increment=1&time_range=${timeRange}`;

  try {
    let hasNextPage = true;
    let page = 1;

    while (hasNextPage) {
      console.log(
        `📄 Buscando página ${page} de gastos para conta ${accountId} (desde ${startDate})...`
      );
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

        console.log(
          `💾 Gasto de ${spend} salvo para ${accountId} em ${day.date_start}`
        );
      }

      if (response.data?.paging?.next) {
        url = response.data.paging.next;
        page++;
      } else {
        hasNextPage = false;
      }
    }

    console.log(`📊 Recalculando gasto total para a conta ${accountId}...`);
    const totalGasto = await prisma.gastoDiario.aggregate({
      _sum: {
        gasto: true,
      },
      where: {
        contaAnuncioId: accountId,
      },
    });

    const gasto = totalGasto._sum.gasto ?? 0;

    const total = Math.floor(
      gasto instanceof Decimal ? gasto.toNumber() : Number(gasto)
    );

    await prisma.adAccount.update({
      where: { id: accountId },
      data: {
        gastoTotal: total,
      },
    });

    console.log(`💰 Gasto total atualizado: ${total}`);
  } catch (error: any) {
    console.error(
      `❌ Erro ao buscar gasto diário da conta ${accountId}:`,
      error.response?.data || error.message || error
    );
  }
}
