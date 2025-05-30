import { PrismaClient } from "@prisma/client";
import { Pagination } from "../inputs/Utils";
import getPageInfo from "../../helpers/getPageInfo";
import {
  ClienteContaAnuncioCreateManyInput,
  TransacaoClienteContaAnuncioInput,
} from "../inputs/cliente-conta-anuncio";
import { Decimal } from "@prisma/client/runtime/library";

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

    let contaAnuncioIdOrigem; // Variável para armazenar o ID da conta de origem
    let contaAnuncioIdDestino; // Variável para armazenar o ID da conta de destino

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
        if (saldoCliente.lt(valorDecimal)) {
          throw new Error("Saldo do cliente insuficiente para a entrada.");
        }

        const contaOrigem = await this.prisma.clienteContaAnuncio.findFirst({
          where: { id: contaOrigemId },
          select: { contaAnuncioId: true },
        });

        if (!contaOrigem) {
          throw new Error("Conta de origem não encontrada.");
        }

        contaAnuncioIdOrigem = contaOrigem.contaAnuncioId;

        // Atualiza a conta de origem
        await this.prisma.clienteContaAnuncio.update({
          where: { id: contaOrigemId },
          data: {
            depositoTotal: {
              increment: valorDecimal,
            },
            saldo: {
              increment: valorDecimal, // Incrementa o saldo da conta de origem
            },
            alocacao_entrada: {
              increment: valorDecimal,
            },
          },
        });

        // Atualiza a conta do anúncio
        await this.prisma.adAccount.update({
          where: { id: contaOrigem.contaAnuncioId },
          data: {
            depositoTotal: {
              increment: valorDecimal,
            },
            saldo: {
              increment: valorDecimal,
            },
            alocacao_entrada_total: {
              increment: valorDecimal,
            },
          },
        });

        // Atualiza o saldo do cliente (decrementa)
        await this.prisma.cliente.update({
          where: { id: clienteId },
          data: {
            saldoCliente: {
              decrement: valorDecimal, // Decrementa o saldo do cliente
            },
            alocacao: {
              increment: valorDecimal,
            },
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
          throw new Error("Saldo insuficiente na conta de origem para saída.");
        }

        const cliente = await this.prisma.cliente.findUnique({
          where: { id: clienteId },
          select: { saldo: true },
        });

        if (!cliente) {
          throw new Error("Cliente não encontrado.");
        }

        // Atualiza o saldo do cliente (incrementa)
        await this.prisma.cliente.update({
          where: { id: clienteId },
          data: {
            saldoCliente: {
              increment: valorDecimal, // Incrementa o saldo do cliente
            },
            alocacao: {
              decrement: valorDecimal,
            },
          },
        });

        // Atualiza a conta do anúncio
        await this.prisma.adAccount.update({
          where: { id: contaOrigem.contaAnuncioId },
          data: {
            saldo: {
              decrement: valorDecimal,
            },
            alocacao_saida_total: {
              increment: valorDecimal,
            },
          },
        });

        // Atualiza o saldo da conta de origem (decrementa)
        await this.prisma.clienteContaAnuncio.update({
          where: { id: contaOrigemId },
          data: {
            saldo: {
              decrement: valorDecimal, // Decrementa o saldo da conta de origem
            },
            alocacao_saida: {
              increment: valorDecimal,
            },
          },
        });

        contaAnuncioIdOrigem = contaOrigem.contaAnuncioId;
        break;
      }

      case "REALOCACAO": {
        // Valida se os IDs foram fornecidos
        if (!contaOrigemId || !contaDestinoId) {
          throw new Error(
            "Conta de origem e conta de destino são obrigatórias para realocação."
          );
        }

        // Busca ambas as contas de forma paralela
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

        // Valida se a conta de origem existe
        if (!contaOrigem) {
          throw new Error("Conta de origem não encontrada.");
        }

        // Valida se a conta de destino existe
        if (!contaDestino) {
          throw new Error("Conta de destino não encontrada.");
        }

        // Verifica saldo suficiente na origem
        const saldoOrigem = new Decimal(contaOrigem.saldo ?? 0);
        if (valorDecimal.gt(saldoOrigem)) {
          throw new Error(
            "Saldo insuficiente na conta de origem para realocação."
          );
        }

        // Define os IDs de contas de anúncio
        contaAnuncioIdOrigem = contaOrigem.contaAnuncioId;
        contaAnuncioIdDestino = contaDestino.contaAnuncioId;

        // Atualiza saldos e totais (em ordem correta)
        await Promise.all([
          // Atualiza clienteContaAnuncio da origem
          this.prisma.clienteContaAnuncio.update({
            where: { id: contaOrigemId },
            data: {
              saldo: { decrement: valorDecimal },
              realocacao_saida: { increment: valorDecimal },
            },
          }),

          // Atualiza clienteContaAnuncio da destino
          this.prisma.clienteContaAnuncio.update({
            where: { id: contaDestinoId },
            data: {
              saldo: { increment: valorDecimal },
              realocacao_entrada: { increment: valorDecimal },
            },
          }),

          // Atualiza adAccount da origem
          this.prisma.adAccount.update({
            where: { id: contaAnuncioIdOrigem },
            data: {
              saldo: { decrement: valorDecimal },
              realocacao_saida_total: { increment: valorDecimal },
            },
          }),

          // Atualiza adAccount da destino
          this.prisma.adAccount.update({
            where: { id: contaAnuncioIdDestino },
            data: {
              saldo: { decrement: valorDecimal }, // Se quiser somar aqui, talvez deveria ser increment?
              realocacao_entrada_total: { increment: valorDecimal },
            },
          }),
        ]);

        break;
      }

      default:
        throw new Error(`Tipo de transação não suportado: ${tipo}`);
    }

    const transacao = await this.prisma.transacaoConta.create({
      data: {
        tipo,
        valor: valorDecimal,
        contaOrigemId: contaAnuncioIdOrigem,
        contaDestinoId: contaAnuncioIdDestino,
        usuarioId,
      },
      select: {
        id: true,
        usuarioId: true,
      },
    });

    return transacao;
  }
}
