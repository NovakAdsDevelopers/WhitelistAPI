import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../database";
import axios from "axios";
import { saveOrUpdateAdAccounts } from "./Account";

// Busca contas com paginação
export async function fetchAllAdAccounts(
  url: string,
  token: string,
  type: "BM1" | "BM2"
) {
  console.log("🔄 Iniciando busca de contas de anúncio no Meta API...");
  console.log("Buscando constas da BM:" + type);
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
        await saveOrUpdateAdAccounts(data.data, token, type);
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

export async function fetchAdAccountsByIds(
  accountIds: string[],
  token: string,
  type: "BM1" | "BM2"
) {
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
    await saveOrUpdateAdAccounts(results, token, type);
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
