import { prisma } from "../../database";
import { ContasAnuncioInput } from "../inputs/conta-anuncio";
import { validate } from "class-validator";
import { BadRequestError } from "../errors/BadRequestError"; // Custom error (exemplo)
import { Pagination } from "../inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";

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

    // 2. Buscar as contas ativas com paginação
    const adAccounts = await prisma.adAccount.findMany({
      where: {
        id: { in: activeAdAccountIds },
      },
      skip: pagina * quantidade,
      take: quantidade,
    });

    if (adAccounts.length === 0) {
      throw new Error("Nenhuma conta encontrada para os filtros aplicados.");
    }

    // 3. Informações de paginação
    const dataTotal = activeAdAccountIds.length;
    const pageInfo = getPageInfo(dataTotal, pagina, quantidade);

    return { result: adAccounts, pageInfo };
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
