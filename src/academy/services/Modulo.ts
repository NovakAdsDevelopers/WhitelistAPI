import { prisma } from "../../database";
import { Pagination } from "../../graphql/inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";
import { ModuloInput, UpdateModuloInput } from "../inputs/Modulo";

export class ModuloService {
  async getModulos(id: number, pagination?: Pagination) {
    let pagina: number = 0;
    let quantidade: number = 10;

    try {
      if (pagination) {
        pagina = pagination.pagina ?? 0;
        quantidade = pagination.quantidade ?? 10;
      }

      const modulos = await prisma.modulo.findMany({
        skip: pagina * quantidade,
        take: quantidade,
        where: { trilhaId: id }
      });

      if (modulos.length === 0) {
        throw new Error(`Nenhum módulo encontrado para a trilha com ID ${id} e os filtros aplicados.`);
      }

      const dataTotal = await prisma.modulo.count({ where: { trilhaId: id } });
      const DataPageInfo = getPageInfo(dataTotal, pagina, quantidade);

      return { result: modulos, pageInfo: DataPageInfo };
    } catch (error) {
      throw new Error(`Erro ao buscar módulos: ${error}`);
    }
  }
  async getModuloById(id: number) {
    const modulo = await prisma.modulo.findUnique({ where: { id } });

    if (!modulo) {
      throw new Error(`Módulo com ID ${id} não encontrado`);
    }

    return modulo;
  }

  async createModulo(data: ModuloInput) {
    if (!data.nome || data.nome.trim().length < 3) {
      throw new Error("O campo 'nome' deve ter pelo menos 3 caracteres.");
    }

    const modulo = await prisma.modulo.create({ data });
    return modulo;
  }

  async updateModulo(id: number, data: UpdateModuloInput) {
    const exists = await prisma.modulo.findUnique({ where: { id } });
    if (!exists) {
      throw new Error(`Não existe módulo com ID ${id}`);
    }

    if (data.nome && data.nome.trim().length < 3) {
      throw new Error("O campo 'nome' deve ter pelo menos 3 caracteres.");
    }

    const modulo = await prisma.modulo.update({
      where: { id },
      data,
    });

    return modulo;
  }

  async deleteModulo(id: number) {
    const exists = await prisma.modulo.findUnique({ where: { id } });
    if (!exists) {
      throw new Error(`Não existe módulo com ID ${id}`);
    }

    await prisma.modulo.delete({ where: { id } });
    return `Módulo com ID ${id} removido com sucesso.`;
  }
}
