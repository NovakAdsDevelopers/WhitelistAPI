import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../database";
import { obterLimitesDinamicos } from "./limite";
import { fetchAdAccountDailySpend } from "./AdAccounts";
import axios from "axios";
import { getLocalDateString, getLocalISOString } from "../../lib/date";

async function atualizarContaExistente(
  account: any,
  existing: any,
  agora: string,
  type: "BM1" | "BM2"
) {
  console.log(
    type === "BM1" ? "🔵Atualizando conta da BM1" : "🔴Atualizando conta da BM2"
  );

  const gastoAnterior = new Decimal(existing.gastoAPI || "0");
  const gastoAtual = new Decimal(account.amount_spent || "0");

  await prisma.adAccount.update({
    where: { id: account.account_id },
    data: {
      nome: account.name,
      status: account.account_status,
      moeda: account.currency,
      fusoHorario: account.timezone_name,
      gastoTotal: gastoAtual,
      gastoAPI: account.amount_spent,
      limiteGasto: account.spend_cap,
      saldoMeta: account.balance,
      ultimaSincronizacao: agora,
      alertaAtivo: true,
    },
  });

  console.log(`✅ Conta ${account.account_id} atualizada.`);
}

async function criarContaNova(
  account: any,
  agora: string,
  type: "BM1" | "BM2"
) {
  console.log(
    type === "BM1" ? "🔵Criando conta da BM1" : "🔴Criando conta da BM2"
  );

  const limites = await obterLimitesDinamicos(
    account.account_id,
    new Date(agora)
  );

  await prisma.adAccount.create({
    data: {
      id: account.account_id,
      nome: account.name,
      status: account.account_status,
      moeda: account.currency,
      fusoHorario: account.timezone_name,
      gastoTotal: new Decimal(account.amount_spent || "0"),
      gastoAPI: account.amount_spent,
      limiteGasto: account.spend_cap,
      saldoMeta: account.balance,
      ultimaSincronizacao: agora,
      alertaAtivo: true,
      ...limites,
    },
  });

  console.log(`✅ Conta ${account.account_id} criada.`);
}

export async function getGastoDiario(
  accountId: string,
  token: string
): Promise<number> {
  const hoje = new Date().toISOString().split("T")[0];

  const timeRange = encodeURIComponent(
    JSON.stringify({ since: hoje, until: hoje })
  );

  const url = `https://graph.facebook.com/v23.0/act_${accountId}/insights?access_token=${token}&fields=spend,date_start&time_increment=1&time_range=${timeRange}`;

  try {
    console.log(
      `📅 Buscando gasto de hoje (${hoje}) para a conta ${accountId}...`
    );

    const response = await axios.get(url);
    const insights = response.data?.data;

    if (!insights || insights.length === 0) {
      console.log(`🔎 Nenhum gasto encontrado para hoje (${hoje}).`);
      return 0;
    }

    const gasto = parseFloat(insights[0].spend || "0");
    console.log(`💰 Gasto de hoje para ${accountId}: ${gasto}`);
    return gasto;
  } catch (error: any) {
    console.error(
      `❌ Erro ao buscar gasto diário da conta ${accountId}:`,
      error.response?.data || error.message || error
    );
    return 0;
  }
}

export async function saveOrUpdateAdAccounts(
  adAccounts: any[],
  token: string,
  type: "BM1" | "BM2"
) {
  for (const account of adAccounts) {
    try {
      const agora = new Date();
      const agoraLocalISO = getLocalISOString(agora); // string "sem Z"

      console.log(agoraLocalISO);

      const existingAccount = await prisma.adAccount.findUnique({
        where: { id: account.account_id },
      });

      if (existingAccount) {
        await atualizarContaExistente(
          account,
          existingAccount,
          agoraLocalISO,
          type
        );
      } else {
        await criarContaNova(account, agoraLocalISO, type);
      }

      // Usa apenas a data local (ex: "2025-06-30") como since
      const sinceDate = getLocalDateString(agora);
      await fetchAdAccountDailySpend(account.account_id, token, sinceDate);

      await prisma.usuario.updateMany({
        data: { ultimaSincronizacao: agoraLocalISO },
      });
    } catch (error) {
      console.error(`❌ Erro ao processar conta ${account.account_id}:`, error);
    }
  }
}
