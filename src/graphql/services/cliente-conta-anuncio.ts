import { PrismaClient } from "@prisma/client";
import { Pagination } from "../inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";
import {
  ClienteContaAnuncioCreateManyInput,
  ClienteContaAnuncioUpdateInput,
  TransacaoClienteContaAnuncioInput,
} from "../inputs/cliente-conta-anuncio";
import { Decimal } from "@prisma/client/runtime/library";
import { ApolloError } from "apollo-server-core";
import { prisma } from "../../database";

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
          ativo: true,
          historico: true,
          saldo: true,
          contaAnuncio: true,
        },
      });

      const gastos = await this.prisma.gastoDiario.findMany({
        where: {
          OR: associacoes.map((a) => ({
            contaAnuncioId: a.contaAnuncioId,
            data: {
              gte: a.inicioAssociacao,
              lte: a.fimAssociacao ?? new Date(),
            },
          })),
        },
      });

      // Agrupar gastos por contaAnuncioId
      const gastosPorConta: Record<string, number> = {};

      for (const gasto of gastos) {
        const contaId = gasto.contaAnuncioId;

        if (!gastosPorConta[contaId]) {
          gastosPorConta[contaId] = 0;
        }

        gastosPorConta[contaId] += gasto.gasto.toNumber();
      }

      // Mapear associações e calcular gastoTotal e saldo dinamicamente
      const associacoesComGastoCalculado = associacoes.map((a) => {
        const gastoTotal = gastos
          .filter(
            (g) =>
              g.contaAnuncioId === a.contaAnuncioId &&
              g.data >= a.inicioAssociacao &&
              g.data <= (a.fimAssociacao ?? new Date())
          )
          .reduce((total, g) => total + g.gasto.toNumber(), 0);

        const deposito = a.depositoTotal?.toNumber?.() ?? 0;
        const saldo = deposito / 100 - gastoTotal;

        return {
          ...a,
          depositoTotal: deposito / 100, // Convertendo para reais
          gastoTotal,
          saldo,
        };
      });

      const total = await this.prisma.clienteContaAnuncio.count({
        where: { clienteId },
      });

      const pageInfo = getPageInfo(total, pagina, quantidade);

      return {
        result: associacoesComGastoCalculado,
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
  async findByAssociacaoId(associacaoId: number) {
    try {
      const associacao = await this.prisma.clienteContaAnuncio.findUnique({
        where: { id: associacaoId },
        select: {
          id: true,
          clienteId: true,
          contaAnuncioId: true,
          inicioAssociacao: true,
          fimAssociacao: true,
          depositoTotal: true,
          ativo: true,
          historico: true,
          saldo: true,
          contaAnuncio: true,
        },
      });

      if (!associacao) {
        throw new Error(`Associação ${associacaoId} não encontrada.`);
      }

      const gastos = await this.prisma.gastoDiario.findMany({
        where: {
          contaAnuncioId: associacao.contaAnuncioId,
          data: {
            gte: associacao.inicioAssociacao,
            lte: associacao.fimAssociacao ?? new Date(),
          },
        },
      });

      const gastoTotal = gastos.reduce(
        (total, g) => total + g.gasto.toNumber(),
        0
      );
  
      return {
        ...associacao,
        gastoTotal
      };
    } catch (error: any) {
      throw new Error(
        `Erro ao buscar associação ${associacaoId}: ${error.message ?? error}`
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

  async update(data: ClienteContaAnuncioUpdateInput) {
    const { id, inicioAssociacao, fimAssociacao } = data;

    try {
      const associacao = await this.prisma.clienteContaAnuncio.update({
        where: { id: Number(id) },
        data: {
          inicioAssociacao,
          fimAssociacao: fimAssociacao ?? null,
        },
        select: {
          id: true,
          clienteId: true,
          contaAnuncioId: true,
          inicioAssociacao: true,
          fimAssociacao: true,
          ativo: true,
          saldo: true,
        },
      });

      return associacao;
    } catch (error) {
      throw new Error(`Erro ao atualizar associação: ${error}`);
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
        if (!cliente) throw new Error("Cliente não encontrado.");

        const saldoCliente = new Decimal(cliente.saldoCliente ?? 0);
        if (valorDecimal.gt(saldoCliente)) {
          throw new ApolloError(
            "Saldo do cliente insuficiente para a entrada.",
            "SALDO_INSUFICIENTE",
            { statusCode: 400 }
          );
        }

        const contaOrigem = await this.prisma.clienteContaAnuncio.findFirst({
          where: { id: contaOrigemId },
          select: { contaAnuncioId: true },
        });
        if (!contaOrigem) throw new Error("Conta de origem não encontrada.");

        contaAnuncioIdOrigem = contaOrigem.contaAnuncioId;

        await this.prisma.$transaction([
          this.prisma.clienteContaAnuncio.update({
            where: { id: contaOrigemId },
            data: {
              depositoTotal: { increment: valorDecimal },
              saldo: { increment: valorDecimal },
              alocacao_entrada: { increment: valorDecimal },
            },
          }),
          this.prisma.adAccount.update({
            where: { id: contaAnuncioIdOrigem },
            data: {
              depositoTotal: { increment: valorDecimal },
              saldo: { increment: valorDecimal },
              alocacao_entrada_total: { increment: valorDecimal },
            },
          }),
          this.prisma.cliente.update({
            where: { id: clienteId },
            data: {
              saldoCliente: { decrement: valorDecimal },
              alocacao: { increment: valorDecimal },
            },
          }),
        ]);
        break;
      }

      case "SAIDA": {
        if (!contaOrigemId)
          throw new Error("Conta origem é obrigatória para saída.");

        const contaOrigem = await this.prisma.clienteContaAnuncio.findUnique({
          where: { id: contaOrigemId },
          select: { saldo: true, contaAnuncioId: true },
        });
        if (!contaOrigem) throw new Error("Conta de origem não encontrada.");

        const saldoOrigem = new Decimal(contaOrigem.saldo ?? 0);
        if (valorDecimal.gt(saldoOrigem)) {
          throw new ApolloError(
            "Saldo insuficiente na conta de origem para saída.",
            "SALDO_INSUFICIENTE",
            { statusCode: 400 }
          );
        }

        const cliente = await this.prisma.cliente.findUnique({
          where: { id: clienteId },
          select: { saldoCliente: true },
        });
        if (!cliente) throw new Error("Cliente não encontrado.");

        contaAnuncioIdOrigem = contaOrigem.contaAnuncioId;

        await this.prisma.$transaction([
          this.prisma.clienteContaAnuncio.update({
            where: { id: contaOrigemId },
            data: {
              saldo: { decrement: valorDecimal },
              alocacao_saida: { increment: valorDecimal },
            },
          }),
          this.prisma.adAccount.update({
            where: { id: contaAnuncioIdOrigem },
            data: {
              saldo: { decrement: valorDecimal },
              alocacao_saida_total: { increment: valorDecimal },
            },
          }),
          this.prisma.cliente.update({
            where: { id: clienteId },
            data: {
              saldoCliente: { increment: valorDecimal },
              alocacao: { decrement: valorDecimal },
            },
          }),
        ]);
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

        if (!contaOrigem) throw new Error("Conta de origem não encontrada.");
        if (!contaDestino) throw new Error("Conta de destino não encontrada.");

        const saldoOrigem = new Decimal(contaOrigem.saldo ?? 0);
        if (valorDecimal.gt(saldoOrigem)) {
          throw new ApolloError(
            "Saldo insuficiente na conta de origem para realocação.",
            "SALDO_INSUFICIENTE",
            { statusCode: 400 }
          );
        }

        contaAnuncioIdOrigem = contaOrigem.contaAnuncioId;
        contaAnuncioIdDestino = contaDestino.contaAnuncioId;

        await this.prisma.$transaction([
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
              depositoTotal: { increment: valorDecimal }, // <- opcional se considerar realocação como novo "depósito"
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
    }

    // Criar transação
    const transacao = await this.prisma.transacaoConta.create({
      data: {
        tipo: tipo as any,
        valor: valorDecimal,
        contaOrigemId: contaAnuncioIdOrigem,
        contaDestinoId: contaAnuncioIdDestino,
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
