import { PrismaClient } from "@prisma/client";
import { Pagination } from "../inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";
import {
  ClienteContaAnuncioCreateManyInput,
  TransacaoClienteContaAnuncioInput,
} from "../inputs/cliente-conta-anuncio";
import { Decimal } from "@prisma/client/runtime/library";
import { ApolloError } from "apollo-server-core";

export class ClienteContaAnuncioService {
  private prisma = new PrismaClient();

  async findByClienteId(clienteId: number, pagination?: Pagination) {
    const pagina = pagination?.pagina ?? 0;
    const quantidade = pagination?.quantidade ?? 10;

    try {
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
          depositoTotal: true,
          gastoTotal: true,
          ativo: true,
          contaAnuncio: true,
          saldo: true,
        },
      });

      const total = await this.prisma.clienteContaAnuncio.count({
        where: { clienteId },
      });

      const pageInfo = getPageInfo(total, pagina, quantidade);

      return {
        result: associacoes,
        pageInfo,
      };
    } catch (error: any) {
      throw new Error(
        `Erro ao buscar associações do cliente ${clienteId}: ${
          error.message ?? error
        }`
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

        // 1. Determina o fim do período
        const dataFim = fimAssociacao ?? agora;

        // 2. Soma os gastos no período
        const totalGasto = await this.prisma.gastoDiario.aggregate({
          where: {
            contaAnuncioId: contaAnuncioId,
            data: {
              gte: inicioAssociacao,
              lte: dataFim,
            },
          },
          _sum: {
            gasto: true,
          },
        });

        const gastoTotalPeriodo = totalGasto._sum.gasto ?? new Decimal(0);

        const gastoTotalEmCentavos = Math.round(
          gastoTotalPeriodo.toNumber() * 100
        );

        console.log(
          `Gasto total no período (centavos): ${gastoTotalEmCentavos}`
        );

        // 3. Cria a associação com o gasto total em centavos
        const associacao = await this.prisma.clienteContaAnuncio.create({
          data: {
            clienteId,
            contaAnuncioId,
            inicioAssociacao,
            fimAssociacao: fimAssociacao ?? null,
            ativo,
            gastoTotal: gastoTotalEmCentavos,
            saldo: -gastoTotalEmCentavos, // ✅ ajuste em centavos
          },
          select: {
            id: true,
            clienteId: true,
            contaAnuncioId: true,
            inicioAssociacao: true,
            fimAssociacao: true,
            ativo: true,
            gastoTotal: true,
            saldo: true,
          },
        });

        associacoes.push(associacao);
      }

      return { associacoes };
    } catch (error) {
      throw new Error(`Erro ao criar associação(ões): ${error}`);
    }
  }

  async push(data: TransacaoClienteContaAnuncioInput) {
    const { contaOrigemId, contaDestinoId, tipo, valor, usuarioId, clienteId } =
      data;

    const tiposValidos = ["ENTRADA", "REALOCACAO", "SAIDA"];
    if (!tiposValidos.includes(tipo)) {
      throw new Error(`Tipo de transação inválido: ${tipo}`);
    }

    if (typeof valor !== "number" || isNaN(valor) || valor <= 0) {
      throw new Error(
        "Valor da transação deve ser um número válido e maior que zero."
      );
    }

    const valorDecimal = new Decimal(valor);

    let contaAnuncioIdOrigem: string | null = null;
    let contaAnuncioIdDestino: string | null = null;

    switch (tipo) {
      case "ENTRADA": {
        const cliente = await this.prisma.cliente.findUnique({
          where: { id: clienteId },
          select: { saldoCliente: true },
        });

        if (!cliente) {
          throw new Error("Cliente não encontrado.");
        }

        const saldoCliente = new Decimal(cliente.saldoCliente ?? 0);
        if (valorDecimal.gt(saldoCliente)) {
          throw new ApolloError(
            "Saldo do cliente insuficiente para a entrada.",
            "SALDO_INSUFICIENTE",
            {
              statusCode: 400,
            }
          );
        }

        const contaOrigem = await this.prisma.clienteContaAnuncio.findFirst({
          where: { id: contaOrigemId },
          select: { contaAnuncioId: true },
        });

        if (!contaOrigem) {
          throw new Error("Conta de origem não encontrada.");
        }

        contaAnuncioIdOrigem = contaOrigem.contaAnuncioId;

        await this.prisma.clienteContaAnuncio.update({
          where: { id: contaOrigemId },
          data: {
            depositoTotal: { increment: valorDecimal },
            saldo: { increment: valorDecimal },
            alocacao_entrada: { increment: valorDecimal },
          },
        });

        await this.prisma.adAccount.update({
          where: { id: contaAnuncioIdOrigem },
          data: {
            depositoTotal: { increment: valorDecimal },
            saldo: { increment: valorDecimal },
            alocacao_entrada_total: { increment: valorDecimal },
          },
        });

        await this.prisma.cliente.update({
          where: { id: clienteId },
          data: {
            saldoCliente: { decrement: valorDecimal },
            alocacao: { increment: valorDecimal },
          },
        });

        break;
      }

      case "SAIDA": {
        if (!contaOrigemId) {
          throw new Error("Conta origem é obrigatória para saída.");
        }

        const contaOrigem = await this.prisma.clienteContaAnuncio.findUnique({
          where: { id: contaOrigemId },
          select: { saldo: true, contaAnuncioId: true },
        });

        if (!contaOrigem) {
          throw new Error("Conta de origem não encontrada.");
        }

        const saldoOrigem = new Decimal(contaOrigem.saldo ?? 0);
        if (valorDecimal.gt(saldoOrigem)) {
          throw new ApolloError(
            "Saldo insuficiente na conta de origem para saída.",
            "SALDO_INSUFICIENTE",
            {
              statusCode: 400,
            }
          );
        }

        const cliente = await this.prisma.cliente.findUnique({
          where: { id: clienteId },
          select: { saldoCliente: true },
        });

        if (!cliente) {
          throw new Error("Cliente não encontrado.");
        }

        await this.prisma.cliente.update({
          where: { id: clienteId },
          data: {
            saldoCliente: { increment: valorDecimal },
            alocacao: { decrement: valorDecimal },
          },
        });

        await this.prisma.adAccount.update({
          where: { id: contaOrigem.contaAnuncioId },
          data: {
            saldo: { decrement: valorDecimal },
            alocacao_saida_total: { increment: valorDecimal },
          },
        });

        await this.prisma.clienteContaAnuncio.update({
          where: { id: contaOrigemId },
          data: {
            saldo: { decrement: valorDecimal },
            alocacao_saida: { increment: valorDecimal },
          },
        });

        contaAnuncioIdOrigem = contaOrigem.contaAnuncioId;

        break;
      }

      case "REALOCACAO": {
        if (!contaOrigemId || !contaDestinoId) {
          throw new Error(
            "Conta de origem e conta de destino são obrigatórias para realocação."
          );
        }

        const [contaOrigem, contaDestino] = await Promise.all([
          this.prisma.clienteContaAnuncio.findUnique({
            where: { id: contaOrigemId },
            select: { saldo: true, contaAnuncioId: true },
          }),
          this.prisma.clienteContaAnuncio.findUnique({
            where: { id: contaDestinoId },
            select: { contaAnuncioId: true },
          }),
        ]);

        if (!contaOrigem) {
          throw new Error("Conta de origem não encontrada.");
        }

        if (!contaDestino) {
          throw new Error("Conta de destino não encontrada.");
        }

        const saldoOrigem = new Decimal(contaOrigem.saldo ?? 0);
        if (valorDecimal.gt(saldoOrigem)) {
          throw new Error(
            "Saldo insuficiente na conta de origem para realocação."
          );
        }

        contaAnuncioIdOrigem = contaOrigem.contaAnuncioId;
        contaAnuncioIdDestino = contaDestino.contaAnuncioId;

        await Promise.all([
          this.prisma.clienteContaAnuncio.update({
            where: { id: contaOrigemId },
            data: {
              saldo: { decrement: valorDecimal },
              realocacao_saida: { increment: valorDecimal },
            },
          }),
          this.prisma.clienteContaAnuncio.update({
            where: { id: contaDestinoId },
            data: {
              saldo: { increment: valorDecimal },
              realocacao_entrada: { increment: valorDecimal },
            },
          }),
          this.prisma.adAccount.update({
            where: { id: contaAnuncioIdOrigem },
            data: {
              saldo: { decrement: valorDecimal },
              realocacao_saida_total: { increment: valorDecimal },
            },
          }),
          this.prisma.adAccount.update({
            where: { id: contaAnuncioIdDestino },
            data: {
              saldo: { increment: valorDecimal },
              realocacao_entrada_total: { increment: valorDecimal },
            },
          }),
        ]);

        break;
      }

      default:
        throw new Error(`Tipo de transação não suportado: ${tipo}`);
    }

    // ✅ Inserção garantida na tabela TransacaoConta
    const transacao = await this.prisma.transacaoConta.create({
      data: {
        tipo: tipo as any, // ou ajuste para enum se necessário
        valor: valorDecimal,
        contaOrigemId: contaAnuncioIdOrigem ?? null,
        contaDestinoId: contaAnuncioIdDestino ?? null,
        usuarioId,
      },
      select: {
        id: true,
        usuarioId: true,
        dataTransacao: true,
        tipo: true,
        valor: true,
      },
    });

    return transacao;
  }
}
