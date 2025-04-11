import { PrismaClient } from "@prisma/client";
import { Pagination } from "../inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";
import { ClienteContaAnuncioCreateManyInput } from "../inputs/cliente-conta-anuncio";

export class ClienteContaAnuncioService {
  private prisma = new PrismaClient();

  async findByClienteId(clienteId: number, pagination?: Pagination) {
    let pagina: number = 0;
    let quantidade: number = 10;

    try {
      if (pagination) {
        pagina = pagination.pagina ?? 0;
        quantidade = pagination.quantidade ?? 10;
      }

      const associacoes = await this.prisma.clienteContaAnuncio.findMany({
        where: { clienteId },
        skip: pagina * quantidade,
        take: quantidade,
        orderBy: {
          inicioAssociacao: "desc",
        },
        select: {
          id: true,
          clienteId: true,
          contaAnuncioId: true,
          inicioAssociacao: true,
          fimAssociacao: true,
          ativo: true,
          contaAnuncio: true, // <- inclui os dados da AdAccount associada
        },
      });

      const total = await this.prisma.clienteContaAnuncio.count({
        where: { clienteId },
      });

      const pageInfo = getPageInfo(total, pagina, quantidade);

      return { result: associacoes, pageInfo };
    } catch (error) {
      throw new Error(
        `Erro ao buscar associações do cliente ${clienteId}: ${error}`
      );
    }
  }

  async create(data: ClienteContaAnuncioCreateManyInput) {
    const { clienteId, contas } = data;
    const agora = new Date();

    try {
      const associacoes = [];

      for (const conta of contas) {
        const { contaAnuncioId, inicioAssociacao, fimAssociacao } = conta;

        const ativo = !fimAssociacao || fimAssociacao > agora;

        const associacao = await this.prisma.clienteContaAnuncio.create({
          data: {
            clienteId,
            contaAnuncioId,
            inicioAssociacao,
            fimAssociacao: fimAssociacao ?? null,
            ativo,
          },
          select: {
            id: true,
            clienteId: true,
            contaAnuncioId: true,
            inicioAssociacao: true,
            fimAssociacao: true,
            ativo: true,
          },
          
        });

        associacoes.push(associacao);
      }

      return { associacoes };
    } catch (error) {
      throw new Error(`Erro ao criar associação(ões): ${error}`);
    }
  }
}
