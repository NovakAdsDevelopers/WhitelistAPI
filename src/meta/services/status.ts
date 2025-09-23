// src/lib/limites.ts
import { prisma } from "../../database";
import { AdAccount } from "../types/AdAccountTypes";

type SaveResult = "created" | "no_change";

function statusLabel(s: number): string {
  if (s === 1) return "ATIVO";
  if (s === 2) return "DESATIVADO";
  return `DESCONHECIDO(${s})`;
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

  if (!Number.isInteger(toStatus)) {
    throw new Error(
      `Status atual inválido: ${toStatusRaw}. Esperado 1 (ATIVO) ou 2 (DESATIVADO).`
    );
  }

  if (fromStatus === toStatus) {
    return "no_change";
  }

  const accountId = String((adAccount as any).id);
  const name = (adAccount as any).name ?? (adAccount as any).nome ?? null;



  await prisma.adAccountStatusChange.create({
    data: {
      accountId,
      name,
      fromStatus,
      toStatus,
      value: adAccount.balance,
      // se quiser usar o default(now()) do schema, pode omitir 'date'
      date: opts?.date ?? new Date(),
    },
  });

  return "created";
}
