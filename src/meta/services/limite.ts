// src/lib/limites.ts
import { prisma } from "../../database";
import { sendSlackAlert } from "../../lib/slack";
import { LimitesDeAlerta } from "../types/LimiteTypes";
import { getGastoDiario } from "./Account";

export function calcularLimitesDinamicos(
  gastoDia: number,
  agora: Date
): LimitesDeAlerta {
  if (!gastoDia || gastoDia <= 0) {
    throw new Error("O gasto do dia deve ser maior que zero.");
  }

  const inicioDoDia = new Date(agora);
  inicioDoDia.setHours(0, 0, 0, 0);

  const minutosPassados = (agora.getTime() - inicioDoDia.getTime()) / 1000 / 60;
  const horasPassadas = Math.max(minutosPassados / 60, 1);
  const gastoPorHora = gastoDia / horasPassadas;

  return {
    limiteCritico: Math.round(gastoPorHora * 1.5),
    limiteMedio: Math.round(gastoPorHora * 3),
    limiteInicial: Math.round(gastoPorHora * 5),
  };
}

export async function verificarESincronizarAlerta(adAccountId: string) {
  const agora = new Date();
  const adAccount = await prisma.adAccount.findUnique({
    where: { id: adAccountId },
  });

  if (!adAccount) return;

  const {
    alertaAtivo,
    saldoMeta,
    limiteInicial,
    limiteMedio,
    limiteCritico,
    ultimoAlertaEnviado,
  } = adAccount;

  // ✅ Só segue se alerta estiver ativo
  if (!alertaAtivo) {
    console.log(`🚫 Alerta não está ativo para a conta ${adAccountId}.`);
    return;
  }

  // ✅ Só segue se já passou 30 minutos desde o último alerta
  const minutosDesdeUltimoAlerta = ultimoAlertaEnviado
    ? (agora.getTime() - new Date(ultimoAlertaEnviado).getTime()) / 1000 / 60
    : Infinity;

  if (minutosDesdeUltimoAlerta < 30) {
    console.log(`⏳ Último alerta para ${adAccountId} foi há ${minutosDesdeUltimoAlerta.toFixed(1)} minutos. Aguardando intervalo mínimo de 30 minutos.`);
    return;
  }

  const saldoAtual = Number(saldoMeta);
  let alerta: "CRÍTICO" | "MÉDIO" | "INICIAL" | null = null;

  if (saldoAtual <= Number(limiteCritico)) alerta = "CRÍTICO";
  else if (saldoAtual <= Number(limiteMedio)) alerta = "MÉDIO";
  else if (saldoAtual <= Number(limiteInicial)) alerta = "INICIAL";

  if (alerta) {
    await sendSlackAlert(
      `⚠️ *Conta ${adAccountId}* está com saldo baixo.\n*Nível: ${alerta}* | Saldo Meta: R$ ${(saldoAtual / 100).toFixed(2)}`
    );

    await prisma.adAccount.update({
      where: { id: adAccountId },
      data: { ultimoAlertaEnviado: agora },
    });

    console.log(`📣 Alerta ${alerta} disparado para a conta ${adAccountId}.`);
  } else {
    console.log(`✅ Conta ${adAccountId} está com saldo acima dos limites.`);
  }
}

export async function autoDisparoAlertas() {
  const agora = new Date();
  const adAccounts = await prisma.adAccount.findMany({
    where: { alertaAtivo: true },
  });

  console.log(`🔍 Verificando alertas para ${adAccounts.length} contas ativas...`);

  for (const adAccount of adAccounts) {
    const {
      id: adAccountId,
      saldoMeta,
      limiteInicial,
      limiteMedio,
      limiteCritico,
      ultimoAlertaEnviado,
    } = adAccount;

    try {
      const minutosDesdeUltimoAlerta = ultimoAlertaEnviado
        ? (agora.getTime() - new Date(ultimoAlertaEnviado).getTime()) / 1000 / 60
        : Infinity;

      if (minutosDesdeUltimoAlerta < 30) {
        console.log(
          `⏳ Último alerta para ${adAccountId} foi há ${minutosDesdeUltimoAlerta.toFixed(
            1
          )} minutos. Aguardando intervalo mínimo de 30 minutos.`
        );
        continue;
      }

      const saldoAtual = Number(saldoMeta);
      let alerta: "CRÍTICO" | "MÉDIO" | "INICIAL" | null = null;

      if (saldoAtual <= Number(limiteCritico)) alerta = "CRÍTICO";
      else if (saldoAtual <= Number(limiteMedio)) alerta = "MÉDIO";
      else if (saldoAtual <= Number(limiteInicial)) alerta = "INICIAL";

      if (alerta) {
        await sendSlackAlert(
          `⚠️ *Conta ${adAccountId}* está com saldo baixo.\n*Nível: ${alerta}* | Saldo Meta: R$ ${(saldoAtual / 100).toFixed(2)}`
        );

        await prisma.adAccount.update({
          where: { id: adAccountId },
          data: { ultimoAlertaEnviado: agora },
        });

        console.log(`📣 Alerta ${alerta} disparado para a conta ${adAccountId}.`);
      } else {
        console.log(`✅ Conta ${adAccountId} está com saldo acima dos limites.`);
      }
    } catch (error) {
      console.error(`❌ Erro ao verificar alerta para conta ${adAccountId}:`, error);
    }
  }

  console.log("🏁 Verificação de alertas concluída.");
}



export async function obterLimitesDinamicos(
  contaAnuncioId: string,
  agora: Date
) {
  const gastoDiario = await prisma.gastoDiario.findFirst({
    where: {
      contaAnuncioId,
      data: {
        gte: new Date(agora.setHours(0, 0, 0, 0)),
        lte: new Date(agora.setHours(23, 59, 59, 999)),
      },
    },
  });

  if (!gastoDiario || Number(gastoDiario.gasto) <= 0) {
    return {
      limiteCritico: "100000",
      limiteMedio: "150000",
      limiteInicial: "200000",
    };
  }

  const calculados = calcularLimitesDinamicos(
    Number(gastoDiario.gasto),
    new Date()
  );
  return {
    limiteCritico: String(calculados.limiteCritico),
    limiteMedio: String(calculados.limiteMedio),
    limiteInicial: String(calculados.limiteInicial),
  };
}

export async function ajusteDiarioLimitesAlerta(token: string) {
  const agora = new Date();
  const accounts = await prisma.adAccount.findMany();

  console.log(`🔄 Iniciando ajuste diário de ${accounts.length} contas...`);

  for (const account of accounts) {
    try {
      const gastoDiario = await getGastoDiario(account.id, token);
      console.log("📊 Gasto diário atual:", gastoDiario);

      if (gastoDiario <= 0) {
        await prisma.adAccount.update({
          where: { id: account.id },
          data: {
            // alertaAtivo: false,
            limiteCritico: "0",
            limiteMedio: "0",
            limiteInicial: "0",
          },
        });
        console.log(`🔕 Conta ${account.id} inativa hoje. Alerta desativado.`);
        continue;
      }

      const limites = calcularLimitesDinamicos(gastoDiario, agora);

      await prisma.adAccount.update({
        where: { id: account.id },
        data: {
          alertaAtivo: true,
          limiteCritico: String(limites.limiteCritico),
          limiteMedio: String(limites.limiteMedio),
          limiteInicial: String(limites.limiteInicial),
        },
      });

      console.log(`✅ Conta ${account.id} ativa. Limites ajustados.`);
    } catch (error) {
      console.error(`❌ Erro ao ajustar conta ${account.id}:`, error);
    }
  }

  console.log("🏁 Ajuste diário de limites concluído.");
}
