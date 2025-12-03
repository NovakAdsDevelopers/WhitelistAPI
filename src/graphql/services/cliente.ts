import { PrismaClient, Cliente } from "@prisma/client";
import { ClienteCreateInput, ClienteUpdateInput } from "../inputs/cliente";
import { Pagination } from "../inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export class ClienteService {
  private prisma = new PrismaClient();

  async login(email: string, senha: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { email } });

    if (!cliente) {
      throw new Error("Cliente não encontrado");
    }

    const senhaValida = cliente.senha
      ? cliente.senha === senha || (await bcrypt.compare(senha, cliente.senha))
      : false;

    if (!senhaValida) {
      throw new Error("Senha incorreta");
    }

    const token = jwt.sign({ clienteId: cliente.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    return { cliente, token };
  }

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

    const contaIds = cliente.contasAnuncio.map((c) => c.id.toString());

    // Soma dos depósitos totais
    const depositoTotalContas = cliente.contasAnuncio.reduce((total, conta) => {
      const deposito = conta.depositoTotal?.toNumber?.() ?? 0;
      return total + deposito;
    }, 0);

    const gastosPorConta = await this.prisma.gastoDiario.groupBy({
      by: ["contaAnuncioId"],
      where: {
        contaAnuncioId: {
          in: contaIds, // agora é string[]
        },
      },
      _sum: {
        gasto: true,
      },
    });

    const gastoTotalContas = gastosPorConta.reduce((total, g) => {
      const valor = g._sum?.gasto?.toNumber?.() ?? 0;
      return total + valor;
    }, 0);

    // Cálculo do saldo total (depósitos - gastos)
    const saldoTotal = depositoTotalContas - gastoTotalContas;
    console.log(
      "CONTAS ASSOCIADAS:",
      JSON.stringify(cliente.contasAnuncio, null, 2)
    );
    console.log("DEPÓSITO TOTAL:", depositoTotalContas);
    console.log("GASTO TOTAL:", gastoTotalContas);
    console.log("SALDO CALCULADO:", saldoTotal);

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
      const deleted = await this.prisma.cliente.delete({
        where: { id },
        select: { id: true },
      });
      return deleted.id;
    } catch (error) {
      return null; // ou lançar um erro, dependendo da sua lógica
    }
  }
}
