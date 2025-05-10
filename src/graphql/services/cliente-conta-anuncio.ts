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
          depositoTotal: true,
          gastoTotal: true, // certifique-se de que esse campo existe no modelo
          ativo: true,
          contaAnuncio: true,
        },
      });
  
      // Calcula saldo manualmente
      const resultadoComSaldo = associacoes.map((assoc): {
        id: number;
        clienteId: number;
        contaAnuncioId: string;
        inicioAssociacao: Date;
        fimAssociacao: Date | null;
        depositoTotal: Decimal;
        gastoTotal?: Decimal;
        ativo: boolean;
        contaAnuncio: any; // ou o tipo real
        saldo: number;
      } => ({
        ...assoc,
        saldo: Number(assoc.depositoTotal) - Number(assoc.gastoTotal ?? 0),
      }));
      
  
      const total = await this.prisma.clienteContaAnuncio.count({
        where: { clienteId },
      });
  
      const pageInfo = getPageInfo(total, pagina, quantidade);
  
      return { result: resultadoComSaldo, pageInfo };
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

        const gastoTotalPeriodo = totalGasto._sum.gasto ?? 0;

        // 3. Cria a associação com o gasto total
        const associacao = await this.prisma.clienteContaAnuncio.create({
          data: {
            clienteId,
            contaAnuncioId,
            inicioAssociacao,
            fimAssociacao: fimAssociacao ?? null,
            ativo,
            gastoTotal: gastoTotalPeriodo
          },
          select: {
            id: true,
            clienteId: true,
            contaAnuncioId: true,
            inicioAssociacao: true,
            fimAssociacao: true,
            ativo: true,
            gastoTotal: true,
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
    const { contaOrigemId, contaDestinoId, tipo, valor, usuarioId, clienteId } = data;

    const tiposValidos = ["ENTRADA", "REALOCACAO", "SAIDA"];
    if (!tiposValidos.includes(tipo)) {
        throw new Error(`Tipo de transação inválido: ${tipo}`);
    }

    const valorNumerico = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
        throw new Error("Valor da transação inválido ou deve ser maior que zero.");
    }

    let contaAnuncioIdOrigem; // Variável para armazenar o ID da conta de origem
    let contaAnuncioIdDestino; // Variável para armazenar o ID da conta de destino

    switch (tipo) {
        case "ENTRADA": {
            // Verificar saldo do cliente
            const cliente = await this.prisma.cliente.findUnique({
                where: { id: clienteId },
                select: { saldo: true },
            });

            if (!cliente) {
                throw new Error("Cliente não encontrado.");
            }

            const saldoCliente = new Decimal(cliente.saldo ?? 0);
            if (saldoCliente.lt(valorNumerico)) {
                throw new Error("Saldo do cliente insuficiente para a entrada.");
            }

            // Salvar o ID da conta de origem
            const contaOrigem = await this.prisma.clienteContaAnuncio.findFirst({
                where: { id: contaOrigemId },
                select: {
                    contaAnuncioId: true,
                },
            });

            if (!contaOrigem) {
                throw new Error("Conta de origem não encontrada.");
            }
            contaAnuncioIdOrigem = contaOrigem.contaAnuncioId;

            // Atualizar conta destino
            await this.prisma.clienteContaAnuncio.update({
                where: { id: contaOrigemId },
                data: {
                    depositoTotal: {
                      increment: valorNumerico
                    }
                },
            });

             // Atualizar conta de anuncio
             await this.prisma.adAccount.update({
              where: { id: contaOrigem.contaAnuncioId },
              data: {
                  depositoTotal: {
                    increment: valorNumerico
                  }
              },
          });


            // Remover o valor do saldo do cliente
            await this.prisma.cliente.update({
                where: { id: clienteId },
                data: {
                    saldo: {
                        decrement: valorNumerico,
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
            if (new Decimal(valorNumerico).gt(saldoOrigem)) {
                throw new Error("Saldo insuficiente na conta de origem para saída.");
            }

            // Atualizar saldo do cliente
            const cliente = await this.prisma.cliente.findUnique({
                where: { id: clienteId },
                select: { saldo: true },
            });

            if (!cliente) {
                throw new Error("Cliente não encontrado.");
            }

            await this.prisma.cliente.update({
                where: { id: clienteId },
                data: {
                    saldo: {
                        increment: valorNumerico,
                    },
                },
            });

            // Atualizar conta de origem
            await this.prisma.clienteContaAnuncio.update({
                where: { id: contaOrigemId },
                data: {
                    saldo: {
                        decrement: valorNumerico,
                    },
                },
            });
            contaAnuncioIdOrigem = contaOrigem.contaAnuncioId; // Salvar o ID da conta de origem
            break;
        }

        case "REALOCACAO": {
            if (!contaOrigemId || !contaDestinoId) {
                throw new Error("Conta de origem e conta de destino são obrigatórias para realocação.");
            }

            const contaOrigem = await this.prisma.clienteContaAnuncio.findUnique({
                where: { id: contaOrigemId },
                select: { saldo: true, contaAnuncioId: true },
            });

            if (!contaOrigem) {
                throw new Error("Conta de origem não encontrada.");
            }

            const saldoOrigem = new Decimal(contaOrigem.saldo ?? 0);
            if (new Decimal(valorNumerico).gt(saldoOrigem)) {
                throw new Error("Saldo insuficiente na conta de origem para realocação.");
            }

            contaAnuncioIdOrigem = contaOrigem.contaAnuncioId; // Salvar o ID da conta de origem

            await this.prisma.clienteContaAnuncio.update({
                where: { id: contaOrigemId },
                data: {
                    saldo: {
                        decrement: valorNumerico,
                    },
                },
            });

            await this.prisma.clienteContaAnuncio.update({
                where: { id: contaDestinoId },
                data: {
                    saldo: {
                        increment: valorNumerico,
                    },
                },
            });

            // Salvar o ID da conta de destino
            const contaDestino = await this.prisma.clienteContaAnuncio.findUnique({
                where: { id: contaDestinoId },
                select: { contaAnuncioId: true },
            });

            if (!contaDestino) {
                throw new Error("Conta de destino não encontrada.");
            }
            contaAnuncioIdDestino = contaDestino.contaAnuncioId;

            break;
        }

        default:
            throw new Error(`Tipo de transação não suportado: ${tipo}`);
    }

    const transacao = await this.prisma.transacaoConta.create({
        data: {
            tipo,
            valor: valorNumerico,
            contaOrigemId: contaAnuncioIdOrigem, // Usando a variável aqui
            contaDestinoId: contaAnuncioIdDestino, // Usando a variável aqui
            usuarioId
        },
        select: {
            id: true,
            usuarioId: true,
        },
    });

    return transacao;
}

}
