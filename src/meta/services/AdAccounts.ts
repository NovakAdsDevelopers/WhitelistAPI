import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../database";
import axios from "axios";
import { saveOrUpdateAdAccounts } from "./Account";
import { getLocalDateString } from "../../lib/date";

const GRAPH_URL = "https://graph.facebook.com/v23.0/me/adaccounts";

type AdAccount = {
  name: string;
  account_id: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  amount_spent?: string;
  spend_cap?: string;
  balance?: string;
};

// Busca contas com paginação
export async function fetchAllAdAccounts(token: string, spend_date?: Date) {
  console.log("🔄 Iniciando busca de contas de anúncio no Meta API...");

  const baseParams = {
    access_token: token,
    fields:
      "name,account_id,account_status,currency,timezone_name,amount_spent,spend_cap,balance",
    limit: 25,
  } as const;

  const seenCursors = new Set<string | null>(); // null para a primeira página
  let after: string | undefined = undefined;
  let totalAccounts = 0;
  let page = 0;
  const maxPages = 2000; // paraquedas

  try {
    while (page < maxPages) {
      page += 1;

      const params = { ...baseParams, ...(after ? { after } : {}) };
      console.log(
        `📡 Página ${page} | GET ${GRAPH_URL} | after=${after ?? "<none>"}`
      );

      const response = await axios.get(GRAPH_URL, { params, timeout: 30000 });
      const data: {
        data?: AdAccount[];
        error?: { message: string; code: number };
        paging?: {
          cursors?: { before?: string; after?: string };
          next?: string;
        };
      } = response.data;

      if (data.error) {
        throw new Error(
          `Erro da API do Facebook: ${data.error.message} (code ${data.error.code})`
        );
      }

      const items = Array.isArray(data.data) ? data.data : [];
      if (items.length > 0) {
        totalAccounts += items.length;
        await saveOrUpdateAdAccounts(items, token, spend_date ? getLocalDateString(spend_date) : undefined); 
      } else {
        console.log("ℹ️ Página vazia recebida — encerrando paginação.");
        break;
      }

      const nextAfter = data.paging?.cursors?.after;

      // Se não veio cursor para continuar, acabou.
      if (!nextAfter) {
        console.log("🏁 Sem cursor 'after' — última página.");
        break;
      }

      // Proteção contra loops: se o mesmo cursor se repetir, paramos.
      if (seenCursors.has(nextAfter)) {
        console.warn(
          `⚠️ Cursor repetido detectado (${nextAfter}) — encerrando para evitar loop.`
        );
        break;
      }
      seenCursors.add(nextAfter);
      after = nextAfter;
    }

    if (page >= maxPages) {
      console.warn(
        `⚠️ Atingiu maxPages (${maxPages}). Verifique paginação/cursors.`
      );
    }

    console.log(
      `✅ Sincronização concluída. Total de contas processadas: ${totalAccounts}`
    );
    return { totalAccounts, pages: page };
  } catch (error) {
    console.error("❌ Erro ao buscar contas de anúncio:", error);
    throw error;
  }
}

export async function fetchAdAccountsByIds(accountIds: string[]) {
  console.log(`🔍 Iniciando sincronização de contas específicas:`, accountIds);

  const results: any[] = [];

  // ============================================================
  // 1) Buscar informações das contas no Meta
  // ============================================================
  for (const accountId of accountIds) {
    try {
      // Buscar no banco
      const adAccount = await prisma.adAccount.findUnique({
        where: { id: accountId },
        include: {
          BM: { include: { token: true } },
        },
      });

      if (!adAccount?.BM?.token) {
        console.warn(
          `⚠️ Conta ${accountId} não está associada a nenhuma BM/token.`
        );
        continue;
      }

      const token = adAccount.BM.token.token;

      console.log(
        `🔑 Usando token da BM (${adAccount.BM.nome}) para conta ${accountId}`
      );

      // Buscar no Meta
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

      if (response.data) {
        console.log(
          `🔹 Dados recebidos para conta ${accountId}:`,
          response.data
        );

        results.push({
          ...response.data,
          account_id: accountId,
        });

        console.log(`✅ Conta ${accountId} carregada com sucesso.`);
      }
    } catch (error) {
      console.error(
        `❌ Erro ao buscar conta ${accountId}:`,
        );
    }
  }

  // ============================================================
  // 2) Salvar e atualizar contas — CADA uma protegida por try/catch
  // ============================================================
  if (results.length === 0) {
    console.log("⚠️ Nenhuma conta válida encontrada para atualizar.");
    return;
  }

  for (const account of results) {
    try {
      const adAccount = await prisma.adAccount.findUnique({
        where: { id: account.account_id },
        include: { BM: { include: { token: true } } },
      });

      if (!adAccount?.BM?.token) {
        console.warn(
          `⚠️ Conta ${account.account_id} não possui token associado ao salvar.`
        );
        continue;
      }

      // SALVAMENTO COM TRY/CATCH GARANTIDO
      await saveOrUpdateAdAccounts([account], adAccount.BM.token.token);

      console.log(`💾 Conta ${account.account_id} atualizada com sucesso.`);
    } catch (err) {
      console.error(
        `❌ ERRO ao salvar/atualizar conta ${account.account_id}:`,
        
      );
    }
  }

  console.log("✅ Finalizado processamento de todas as contas.");
}

// Busca e salva gasto diário dos últimos 7 dias
export async function fetchAdAccountDailySpend(
  accountId: string,
  token: string,
  since?: string
) {
  console.log("Esse é o valor do since:" + since);
  const today = new Date().toISOString().split("T")[0];
  // Datas base
  const DEFAULT_DATE = "2024-06-01";
  const NEWER_DATE = "2025-08-01";

  // Evite deixar o token em claro no código.
  // Ideal: ler de variável de ambiente (process.env.SPECIAL_TOKEN)
  const SPECIAL_TOKEN =
    "EAA693DhICI8BPrq7dGZAbh2TEW3gx0JP26riNlNp9vUFFbXIAoJedQzZAo1R75P0tHlk2yqpjNmvyHFFihMmPpb5mrbKV5o2nxsjjidv6jSjKZBR5LZBdAF59HJhXcr6sKS5H59Uy3Yw8rOirkqGNBhg2euQvYZAcWZCXgWw0PxqqDS6qc64T8m2Cje6LNuKdj0Flq4elSjn1pnYiq4Q4ZD";

  const startDate = since
    ? new Date(since).toISOString().slice(0, 10)
    : token === SPECIAL_TOKEN
    ? NEWER_DATE
    : DEFAULT_DATE;
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
