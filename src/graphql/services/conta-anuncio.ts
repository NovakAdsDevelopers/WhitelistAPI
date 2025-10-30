import { prisma } from "../../database";
import { ContasAnuncioInput } from "../inputs/conta-anuncio";
import { validate } from "class-validator";
import { BadRequestError } from "../errors/BadRequestError"; // Custom error (exemplo)
import { Pagination } from "../inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";
import { Decimal } from "@prisma/client/runtime/library";

// Toggle de logs
const DEBUG = true;

// util: log condicionado
function dlog(...args: any[]) {
  if (DEBUG) console.log("[getAllAccountsSpend]", ...args);
}

// util: serialização segura
function safeJSON(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export class ContasAnuncioService {
  async getAll(pagination?: Pagination) {
    const pagina = pagination?.pagina ?? 0;
    const quantidade = pagination?.quantidade ?? 10;

    // Data de 30 dias atrás
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

    // 1. Buscar os IDs das contas com gastos nos últimos 30 dias
    const activeAdAccountIdsResult = await prisma.gastoDiario.findMany({
      where: {
        data: { gte: thirtyDaysAgo },
        gasto: { gt: 0 },
      },
      select: { contaAnuncioId: true },
      distinct: ["contaAnuncioId"],
    });

    const activeAdAccountIds = activeAdAccountIdsResult.map(
      (item) => item.contaAnuncioId
    );

    if (activeAdAccountIds.length === 0) {
      throw new Error(
        "Nenhuma conta encontrada com gastos nos últimos 30 dias."
      );
    }

    // 2. Buscar as contas ativas com paginação + BM associada
    const adAccounts = await prisma.adAccount.findMany({
      where: {
        id: { in: activeAdAccountIds },
        NOT: {
          BMId: "782449695464660", // 👈 exclui contas dessa BM
        },
      },
      skip: pagina * quantidade,
      take: quantidade,
      include: {
        BM: true, // ✅ inclui a BM associada
      },
    });

    if (adAccounts.length === 0) {
      throw new Error("Nenhuma conta encontrada para os filtros aplicados.");
    }

    // 3. Informações de paginação
    const dataTotal = activeAdAccountIds.length;
    const pageInfo = getPageInfo(dataTotal, pagina, quantidade);

    return { result: adAccounts, pageInfo };
  }

  async getAllAccounts(pagination?: Pagination) {
    const pagina = pagination?.pagina ?? 0;
    const quantidade = pagination?.quantidade ?? 10;

    // 🔍 2. Buscar todas as contas de anúncio com paginação (sem filtro)
    const adAccounts = await prisma.adAccount.findMany({
      // where: {
      //   id: { in: activeAdAccountIds }, // 🔒 filtro desativado
      // },
      include: { BM: true }, // Inclui dados do BM relacionado
      skip: pagina * quantidade,
      take: quantidade,
    });

    if (adAccounts.length === 0) {
      throw new Error("Nenhuma conta encontrada.");
    }

    // 🔢 Total de contas para a paginação
    // const dataTotal = activeAdAccountIds.length; // ❌ antigo
    const dataTotal = await prisma.adAccount.count(); // ✅ novo
    const pageInfo = getPageInfo(dataTotal, pagina, quantidade);

    return { result: adAccounts, pageInfo };
  }

  async getAllAccountsSpend(pagination?: Pagination) {
    const pagina = pagination?.pagina ?? 0;
    const quantidade = pagination?.quantidade ?? 10;

    const BM_TARGET = "782449695464660";
    console.log("🚀 Iniciando getAllAccountsSpend para BM", BM_TARGET);

    // 1️⃣ Buscar contas vinculadas à BM
    const adAccounts = await prisma.adAccount.findMany({
      skip: pagina * quantidade,
      take: quantidade,
      include: { BM: true },
      where: { BMId: BM_TARGET },
    });

    if (adAccounts.length === 0) {
      throw new Error("Nenhuma conta encontrada para esta BM.");
    }

    // 2️⃣ Calcular o dia de ontem (sem hora)
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);

    const diaOntem = ontem.toISOString().split("T")[0]; // ex: '2025-10-27'
    console.log("📅 Dia alvo (ontem):", diaOntem);

    // 3️⃣ Buscar todos os gastos do dia anterior de uma vez só
    const gastos = await prisma.gastoDiario.findMany({
      where: {
        data: {
          gte: new Date(`${diaOntem}T00:00:00.000Z`),
          lt: new Date(`${diaOntem}T23:59:59.999Z`),
        },
      },
    });

    console.log("🧾 Registros de gastoDiario retornados:", gastos.length);

    // 4️⃣ Mapear gasto por conta
    const gastoPorConta = new Map<string, string>();
    for (const g of gastos) {
      const soma = g.gasto ?? new Decimal(0);
      gastoPorConta.set(String(g.contaAnuncioId), soma.mul(100).toFixed(0)); // centavos
    }

    // 5️⃣ Montar resultado
    const result = adAccounts.map((acc) => {
      const gasto = gastoPorConta.get(String(acc.id)) ?? "0";
      console.log(`💰 Conta ${acc.id} (${acc.nome}) → Gasto diário: ${gasto}`);
      return {
        id: acc.id,
        nome: acc.nome,
        status: acc.status,
        moeda: acc.moeda,
        fusoHorario: acc.fusoHorario,
        gastoDiario: gasto,
        limiteGasto: acc.limiteGasto,
        saldoMeta: acc.saldoMeta,
        saldo: acc.saldo,
        depositoTotal: acc.depositoTotal,
        ultimaSincronizacao: acc.ultimaSincronizacao,
        BMId: acc.BM?.id ?? acc.BMId ?? "",
      };
    });

    // 6️⃣ Paginação total
    const dataTotal = await prisma.adAccount.count({
      where: { BMId: BM_TARGET },
    });
    const pageInfo = getPageInfo(dataTotal, pagina, quantidade);

    console.log(
      "✅ Finalizado. Contas:",
      adAccounts.length,
      "| Gastos encontrados:",
      gastos.length
    );
    return { result, pageInfo };
  }

  async getAllAccountsFunds(adAccountId: string, pagination?: Pagination) {
    const pagina = pagination?.pagina ?? 0;
    const quantidade = pagination?.quantidade ?? 10;

    // 0) Buscar o nome da conta uma única vez (pelo id recebido)
    //    Ajuste o nome do modelo/campo conforme seu schema Prisma (ex.: AdAccount/Account)
    const account = await prisma.adAccount.findUnique({
      where: { id: adAccountId },
      select: { nome: true },
    });

    // 1) Buscar todos os fundos (MetaPix) associados à conta
    const pixs = await prisma.metaPix.findMany({
      skip: pagina * quantidade,
      take: quantidade,
      where: {
        accountId: adAccountId, // busca por conta
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (pixs.length === 0) {
      throw new Error("Nenhum fundo encontrado para esta conta.");
    }

    // (Se a janela de ontem não for usada, pode remover este bloco)
    // const startOfToday = new Date();
    // startOfToday.setHours(0, 0, 0, 0);
    // const startOfYesterday = new Date(startOfToday);
    // startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    // const endOfYesterday = new Date(startOfToday);

    // 3) IDs das transações (MetaPix) da página atual (se precisar)
    // const pixIds = pixs.map((a) => a.id);

    // 4) Monta retorno no shape esperado

    const result = pixs.map((pix) => ({
      id: pix.id,
      accountId: pix.accountId,
      accountName: account?.nome, // <- preenchido a partir do id da conta
      bmId: pix.bmId,
      bmNome: pix.bmNome,
      imageUrl: pix.imageUrl,
      codigoCopiaCola: pix.codigoCopiaCola,
      valor: pix.valor,
      usuarioId: pix.usuarioId,
      usuarioNome: pix.usuarioNome,
      dataPagamento: pix.dataPagamento,
      dataOperacao: pix.dataOperacao,
      tipoRetorno: pix.tipoRetorno,
      codigoSolicitacao: pix.codigoSolicitacao,
      createdAt: pix.createdAt,
      updatedAt: pix.updatedAt,
    }));

    // 5) Paginação total
    const dataTotal = await prisma.metaPix.count({
      where: {
        accountId: adAccountId,
      },
    });

    const pageInfo = getPageInfo(dataTotal, pagina, quantidade);

    return { result, pageInfo };
  }

  async getById(id: string) {
    return await prisma.adAccount.findUnique({ where: { id } });
  }

  async create(data: ContasAnuncioInput) {
    // Validando os dados antes de salvar
    const errors = await validate(data);
    if (errors.length > 0) {
      throw new BadRequestError("Invalid data", errors);
    }

    // Adiciona a data atual no campo exigido
    const dataComData = {
      ...data,
      ultimaSincronizacao: new Date().toISOString(),
    };

    return await prisma.adAccount.create({ data: dataComData });
  }

  async update(id: string, data: Partial<ContasAnuncioInput>) {
    // Validando os dados antes de atualizar
    const errors = await validate(data);
    if (errors.length > 0) {
      throw new BadRequestError("Invalid data", errors);
    }

    return await prisma.adAccount.update({ where: { id }, data });
  }

  async delete(id: string) {
    return await prisma.adAccount.delete({ where: { id } });
  }

  async switchAlerta(id: string, alertaAtivo: boolean): Promise<void> {
    try {
      await prisma.adAccount.update({
        where: { id },
        data: { alertaAtivo },
      });
    } catch (err) {
      throw new Error(`Conta de anúncio ${id} não encontrada`);
    }
  }
}
