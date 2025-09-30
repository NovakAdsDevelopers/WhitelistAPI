import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../database";
import { obterLimitesDinamicos } from "./limite";
import { fetchAdAccountDailySpend } from "./AdAccounts";
import axios from "axios";
import { getLocalDateString, getLocalISOString } from "../../lib/date";
import { salvarStatusConta } from "./status";

// Helpers para conversões seguras
const toDecimal = (v: any) => {
  try {
    // aceita number | string | null | undefined
    if (v === null || v === undefined || v === "") return new Decimal(0);
    return new Decimal(v);
  } catch {
    return new Decimal(0);
  }
};

const centsToUnit = (d: Decimal) => d.div(100);

async function atualizarContaExistente(
  account: any,
  existing: any,
  agora: string
) {
  // Valores em "centavos" conforme API do Facebook
  const amount_spent = parseFloat(account?.amount_spent ?? "0");
  const spend_cap = parseFloat(account?.spend_cap ?? "0");
  const balanceStr = account?.balance ?? "0";
  const currency = account?.currency ?? "USD";

  console.log(
    `amount_spent: ${amount_spent}, spend_cap: ${spend_cap}, balance: ${balanceStr}, currency: ${currency}`
  );

  // Conversão do balance igual ao Python: tenta parsear e divide por 100.0
  let balance;
  const parsedBalance = parseFloat(balanceStr);
  if (Number.isNaN(parsedBalance)) {
    console.log(`Erro ao converter balance: ${balanceStr}`);
    balance = 0.0;
  } else {
    balance = parsedBalance / 100.0;
    console.log(`Balance convertido para float: ${balance}`);
  }

  // Mantido exatamente como no Python:
  // available_funds em unidade de moeda (dividido por 100 ao final),
  // somando (spend_cap - amount_spent + balance)
  const available_funds = (spend_cap - amount_spent + balance) / 100.0;
  console.log(`available_funds calculado: ${available_funds}`);

  // Mantém compatibilidade com os campos existentes
  const gastoAnterior = toDecimal(existing.gastoAPI || "0");
  const gastoAtual = toDecimal(account.amount_spent || "0");

  // ✔️ verifica mudança de status
  const fromStatus: number = existing.status; // status anterior (int)
  const toStatus: number = account.account_status ?? account.status; // status atual (int)

  if (fromStatus !== toStatus) {
    await salvarStatusConta(account, fromStatus, {
      // usa o balance "bruto" em cents para manter o comportamento atual
      valueOverride: String(account.balance ?? existing.saldoMeta ?? "0"),
    });
  }

  // Log amigável para depuração
  console.log("💳 Cálculo saldo pré-pago disponível:", {
    account_id: account.account_id,
    spend_cap_cents: spend_cap,
    amount_spent_cents: amount_spent,
    balance_cents: balance,
    available_prepaid_funds_unit: available_funds,
    currency: account.currency,
  });

  await prisma.adAccount.update({
    where: { id: account.account_id },
    data: {
      nome: account.name,
      status: account.account_status,
      moeda: account.currency,
      fusoHorario: account.timezone_name,
      gastoTotal: gastoAtual, // em cents (Decimal)
      gastoAPI: account.amount_spent, // raw da API
      limiteGasto: account.spend_cap, // raw da API (cents)
      saldoMeta: String(available_funds), // raw da API (cents)
      ultimaSincronizacao: agora,
      alertaAtivo: true,
    },
  });

  console.log(`✅ Conta ${account.account_id} atualizada.`);
}

async function criarContaNova(account: any, agora: string) {
  const limites = await obterLimitesDinamicos(
    account.account_id,
    new Date(agora)
  );

  const centsToUnit = (d: Decimal) => d.div(100);

  // Valores em "centavos" conforme API do Facebook
  const amountSpentCents = toDecimal(account.amount_spent); // ex.: "12345"
  const spendCapCents = toDecimal(account.spend_cap); // ex.: "200000"
  const balanceCents = toDecimal(account.balance); // ex.: "-6789"

  // ✳️ Saldo pré-pago disponível (em unidade monetária):
  // (spend_cap - amount_spent + balance) / 100
  const availablePrepaidFunds = spendCapCents
    .minus(amountSpentCents)
    .plus(balanceCents);
  const availablePrepaidFundsUnit = centsToUnit(availablePrepaidFunds);

  // Log amigável para depuração
  console.log("💳 Cálculo saldo pré-pago disponível:", {
    account_id: account.account_id,
    spend_cap_cents: spendCapCents.toString(),
    amount_spent_cents: amountSpentCents.toString(),
    balance_cents: balanceCents.toString(),
    available_prepaid_funds_unit: availablePrepaidFundsUnit.toFixed(2),
    currency: account.currency,
  });

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
      saldoMeta: String(availablePrepaidFundsUnit),
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

export async function saveOrUpdateAdAccounts(adAccounts: any[], token: string) {
  for (const account of adAccounts) {
    try {
      const agora = new Date();
      const agoraLocalISO = getLocalISOString(agora); // string "sem Z"

      console.log(agoraLocalISO);

      const existingAccount = await prisma.adAccount.findUnique({
        where: { id: account.account_id },
      });

      if (existingAccount) {
        await atualizarContaExistente(account, existingAccount, agoraLocalISO);
      } else {
        await criarContaNova(account, agoraLocalISO);
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


export async function renameAdAccountWithToken(
  token: string,
  adAccountId: string,
  newName: string
) {
  const url = `https://graph.facebook.com/v23.0/act_${encodeURIComponent(adAccountId)}`;
  const params = new URLSearchParams({
    name: newName,
    access_token: token,
  });

  // 1) Renomeia no Meta (se falhar, lança e nada mais acontece)
  const { data } = await axios.post(url, params);

  // 2) Atualiza no banco
  await prisma.adAccount.update({
    where: { id: adAccountId },
    data: { nome: newName },
  });

  // 3) Mantém o retorno original (payload do Meta)
  return data;
}