import { prisma } from "../../database";
import { ContasAnuncioInput } from "../inputs/conta-anuncio";
import { validate } from "class-validator";
import { BadRequestError } from "../errors/BadRequestError"; // Custom error (exemplo)
import { Pagination } from "../inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";

export class ContasAnuncioService {
  async getAll(pagination?: Pagination) {
    let pagina: number = 0;
    let quantidade: number = 10;

    if (pagination) {
      pagina = pagination.pagina ?? 0;
      quantidade = pagination.quantidade ?? 10;
    }

    const adAccounts = await prisma.adAccount.findMany({
      skip: pagina * quantidade,
      take: quantidade,
    });

    if (adAccounts.length === 0) {
      throw new Error(`Nenhuma conta encontrada para os filtros aplicados.`);
    }

    // Conta total de registros
    const dataTotal = await prisma.adAccount.count();

    // Prepara o PaginationInfo
    const DataPageInfo = getPageInfo(dataTotal, pagina, quantidade);

    return { result: adAccounts, pageInfo: DataPageInfo };
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

    return await prisma.adAccount.create({ data });
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
}
