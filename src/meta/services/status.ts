// src/lib/limites.ts
import { prisma } from "../../database";
import { AdAccount } from "../types/AdAccountTypes";

type SaveResult = "created" | "no_change";

function statusLabel(s: number): string {
  if (s === 1) return "ATIVO";
  if (s === 2) return "DESATIVADO";
  return `ENCERRADA(${s})`;
}

/**
 * Registra mudança de status da conta (1=ATIVO, 2=DESATIVADO) no model AdAccountStatusChange.
 * - NÃO mexe no model AdAccount.
 * - Só cria registro se houver de fato mudança (fromStatus !== toStatus).
 */
export async function salvarStatusConta(
  adAccount: AdAccount,
  fromStatus: number,
  opts?: { date?: Date; valueOverride?: string }
): Promise<SaveResult> {
  // pega o status atual vindo do objeto (suporta account_status ou status)
  const toStatusRaw =
    (adAccount as any).account_status ?? (adAccount as any).status;
  const toStatus = Number(toStatusRaw);

  console.debug("[salvarStatusConta] Verificando mudança de status", {
    accountId: (adAccount as any).id,
    fromStatus,
    toStatus,
    rawStatus: toStatusRaw,
  });

  if (!Number.isInteger(toStatus)) {
    throw new Error(
      `Status atual inválido: ${toStatusRaw}. Esperado 1 (ATIVO) ou 2 (DESATIVADO).`
    );
  }

  // só registra se realmente houve mudança
  if (fromStatus === toStatus) {
    console.debug("[salvarStatusConta] Nenhuma mudança de status detectada", {
      accountId: (adAccount as any).id,
      status: toStatus,
    });
    return "no_change";
  }

  const accountId = String((adAccount as any).id);
  const name = (adAccount as any).name ?? (adAccount as any).nome ?? null;
  const value = opts?.valueOverride ?? adAccount.balance ?? null;

  console.info("[salvarStatusConta] Mudança detectada — criando registro", {
    accountId,
    name,
    de: fromStatus,
    para: toStatus,
    value,
    date: opts?.date ?? new Date(),
  });

  await prisma.adAccountStatusChange.create({
    data: {
      accountId,
      name,
      fromStatus,
      toStatus,
      value,
      date: opts?.date ?? new Date(), // usa a data informada ou atual
    },
  });

  console.info("[salvarStatusConta] Registro criado com sucesso", {
    accountId,
    fromStatus,
    toStatus,
  });

  return "created";
}

