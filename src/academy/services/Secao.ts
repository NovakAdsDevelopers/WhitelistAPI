import { prisma } from "../../database";
import { Pagination } from "../../graphql/inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";
import { SecaoInput, UpdateSecaoInput } from "../inputs/Secao";

export class SecaoService {
  async getSecoes(id: number, pagination?: Pagination) {
    let pagina: number = 0;
    let quantidade: number = 10;

    try {
      if (pagination) {
        pagina = pagination.pagina ?? 0;
        quantidade = pagination.quantidade ?? 10;
      }

      const secoes = await prisma.secao.findMany({
        skip: pagina * quantidade,
        take: quantidade,
        where: { moduloId: id }
      });

      if (secoes.length === 0) {
        throw new Error(`Nenhuma seção encontrada para o módulo com ID ${id} e os filtros aplicados.`);
      }

      const dataTotal = await prisma.secao.count({ where: { moduloId: id } });
      const DataPageInfo = getPageInfo(dataTotal, pagina, quantidade);

      return { result: secoes, pageInfo: DataPageInfo };
    } catch (error) {
      throw new Error(`Erro ao buscar seções: ${error}`);
    }
  }
  async getSecaoById(id: number) {
    const secao = await prisma.secao.findUnique({ where: { id } });

    if (!secao) {
      throw new Error(`Seção com ID ${id} não encontrada`);
    }

    return secao;
  }

  async createSecao(data: SecaoInput) {
    if (!data.nome || data.nome.trim().length < 3) {
      throw new Error("O campo 'nome' deve ter pelo menos 3 caracteres.");
    }

    const secao = await prisma.secao.create({ data });
    return secao;
  }

  async updateSecao(id: number, data: UpdateSecaoInput) {
    const exists = await prisma.secao.findUnique({ where: { id } });
    if (!exists) {
      throw new Error(`Não existe seção com ID ${id}`);
    }

    if (data.nome && data.nome.trim().length < 3) {
      throw new Error("O campo 'nome' deve ter pelo menos 3 caracteres.");
    }

    const secao = await prisma.secao.update({
      where: { id },
      data,
    });

    return secao;
  }

  async deleteSecao(id: number) {
    const exists = await prisma.secao.findUnique({ where: { id } });
    if (!exists) {
      throw new Error(`Não existe seção com ID ${id}`);
    }

    await prisma.secao.delete({ where: { id } });
    return `Seção com ID ${id} removida com sucesso.`;
  }
}
