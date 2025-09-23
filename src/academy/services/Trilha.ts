import { prisma } from "../../database";
import { Pagination } from "../../graphql/inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";
import { TrilhaInput, UpdateTrilhaInput } from "../inputs/Trilha";

export class TrilhaService {
  async getTrilhas(pagination?: Pagination) {
    let pagina: number = 0;
    let quantidade: number = 10;

    try {
      if (pagination) {
        pagina = pagination.pagina ?? 0;
        quantidade = pagination.quantidade ?? 10;
      }

      const trilhas = await prisma.trilha.findMany({
        skip: pagina * quantidade,
        take: quantidade,
      });

      if (trilhas.length === 0) {
        throw new Error(`Nenhuma trilha encontrada com os filtros aplicados.`);
      }

      const dataTotal = await prisma.trilha.count();
      const DataPageInfo = getPageInfo(dataTotal, pagina, quantidade);

      return { result: trilhas, pageInfo: DataPageInfo };
    } catch (error) {
      throw new Error(`Erro ao buscar trilhas: ${error}`);
    }
  }

  async getTrilhaById(id: number) {
    const trilha = await prisma.trilha.findUnique({ where: { id }, select: { modulos: true } });

    if (!trilha) {
      throw new Error(`Trilha com ID ${id} não encontrada`);
    }

    return trilha;
  }

  async createTrilha(data: TrilhaInput) {
    if (!data.nome || data.nome.trim().length < 3) {
      throw new Error("O campo 'nome' deve ter pelo menos 3 caracteres.");
    }

    const trilha = await prisma.trilha.create({ data });
    return trilha;
  }

  async updateTrilha(id: number, data: UpdateTrilhaInput) {
    const exists = await prisma.trilha.findUnique({ where: { id } });
    if (!exists) {
      throw new Error(`Não existe trilha com ID ${id}`);
    }

    if (data.nome && data.nome.trim().length < 3) {
      throw new Error("O campo 'nome' deve ter pelo menos 3 caracteres.");
    }

    const trilha = await prisma.trilha.update({
      where: { id },
      data,
    });

    return trilha;
  }

  async deleteTrilha(id: number) {
    const exists = await prisma.trilha.findUnique({ where: { id } });
    if (!exists) {
      throw new Error(`Não existe trilha com ID ${id}`);
    }

    await prisma.trilha.delete({ where: { id } });
    return `Trilha com ID ${id} removida com sucesso.`;
  }
}
