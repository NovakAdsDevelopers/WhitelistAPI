import { PrismaClient, Cliente } from "@prisma/client";
import { ClienteCreateInput, ClienteUpdateInput } from "../inputs/cliente";
import { Pagination } from "../inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";

export class ClienteService {
  private prisma = new PrismaClient();

  async findAll(pagination?: Pagination) {
    let pagina: number = 0;
    let quantidade: number = 10;

    try {
      if (pagination) {
        pagina = pagination.pagina ?? 0;
        quantidade = pagination.quantidade ?? 10;
      }

      const clientes = await this.prisma.cliente.findMany({
        skip: pagina * quantidade,
        take: quantidade,
      });

      if (clientes.length === 0) {
        throw new Error(`Nenhum cliente encontrado com os filtros aplicados.`);
      }

      const dataTotal = await this.prisma.cliente.count();
      const DataPageInfo = getPageInfo(dataTotal, pagina, quantidade);

      return { result: clientes, pageInfo: DataPageInfo };
    } catch (error) {
      throw new Error(`Erro ao buscar clientes: ${error}`);
    }
  }

  async findById(id: number) {
  const cliente = await this.prisma.cliente.findUnique({
    where: { id },
    include: {
      contasAnuncio: true,
    },
  });

  if (!cliente) return null;

  const saldoTotal = cliente.contasAnuncio.reduce((total, conta) => {
    const saldo = conta.saldo?.toNumber?.() || 0;
    return total + saldo;
  }, 0);

  const gastoTotalContas = cliente.contasAnuncio.reduce((total, conta) => {
    const gasto = conta.gastoTotal?.toNumber?.() || 0;
    return total + gasto;
  }, 0);

  console.log("CONTAS ASSOCIADAS:", JSON.stringify(cliente.contasAnuncio, null, 2));
  console.log("SALDO DAS CONTAS:", saldoTotal);
  console.log("GASTO TOTAL:", gastoTotalContas);

  return {
    ...cliente,
    saldo: saldoTotal,
    gastoTotal: gastoTotalContas,
  };
}


  async create(data: ClienteCreateInput) {
    return this.prisma.cliente.create({
      data: {
        nome: data.nome,
        email: data.email,
        fee: data.fee,
        cnpj: data.cnpj,
      },
    });
  }

  async update(id: number, data: ClienteUpdateInput) {
    return this.prisma.cliente.update({
      where: { id },
      data: {
        nome: data.nome,
        email: data.email,
      },
    });
  }

  async delete(id: number) {
    try {
      await this.prisma.cliente.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
