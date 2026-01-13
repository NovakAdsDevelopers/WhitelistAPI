import { prisma } from "../../database";
import { TransacaoClienteInput } from "../inputs/cliente-transacao";
import { validate } from "class-validator";
import { BadRequestError } from "../errors/BadRequestError";
import { Decimal } from "@prisma/client/runtime/library";

export class TransacaoService {
  
  async create(data: TransacaoClienteInput) {
    // 1. Validação dos dados de entrada (class-validator)
    const errors = await validate(data);
    if (errors.length > 0) {
      throw new BadRequestError("Dados inválidos", errors);
    }

    // 2. Transação Database (Atomicidade)
    // Tudo aqui dentro roda junto. Se der erro, desfaz tudo.
    return await prisma.$transaction(async (tx) => {
      // Verifica se o cliente existe e busca o saldo atual (saldoCliente)
      const cliente = await tx.cliente.findUnique({
        where: { id: data.clienteId },
        select: { 
          id: true, 
          saldoCliente: true // Ajustado para ler o mesmo campo que será atualizado
        },
      });

      if (!cliente) {
        throw new BadRequestError("Cliente não encontrado.", []);
      }

      // Se for SAÍDA, valida o saldo
      if (data.tipo === "SAIDA") {
        const saldoAtual = new Decimal(cliente.saldoCliente || 0);
        
        if (new Decimal(data.valor).gt(saldoAtual)) {
          throw new BadRequestError(
            "Saldo insuficiente para realizar a transação",
            []
          );
        }
      }

      // Cria a transação usando o cliente da transação (tx)
      const transacao = await tx.transacaoCliente.create({ data });

      // Atualiza o saldo do cliente
      if (data.tipo === "ENTRADA") {
        await tx.cliente.update({
          where: { id: data.clienteId },
          data: {
            saldoCliente: { increment: data.valorAplicado },
            depositoTotal: { increment: data.valorAplicado },
          },
        });
      } else if (data.tipo === "SAIDA") {
        await tx.cliente.update({
          where: { id: data.clienteId },
          data: {
            saldoCliente: { decrement: data.valor },
          },
        });
      }

      return transacao;
    });
  }

  async update(id: number, data: Partial<TransacaoClienteInput>) {
    // 1. Validação de input
    const errors = await validate(data);
    if (errors.length > 0) {
      throw new BadRequestError("Dados inválidos para atualização", errors);
    }

    // 2. Verificar se a transação existe no banco
    const transacaoExistente = await prisma.transacaoCliente.findUnique({
      where: { id },
    });

    if (!transacaoExistente) {
      throw new BadRequestError("Transação não encontrada para atualização.");
    }

    // 3. Validação de Regra de Negócio:
    // Não permitir alterar valores financeiros, pois isso quebra o saldo do cliente.
    // Para corrigir valor, deve-se estornar (deletar) e criar outra.
    if (data.valor || data.tipo || data.clienteId || data.valorAplicado) {
      throw new BadRequestError(
        "Não é permitido alterar valores, tipo ou cliente de uma transação já efetivada. Exclua e crie novamente."
      );
    }

    // 4. Executa update
    return await prisma.transacaoCliente.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    // 1. Verificar se existe
    const transacao = await prisma.transacaoCliente.findUnique({
      where: { id },
    });

    if (!transacao) {
      throw new BadRequestError("Transação não encontrada para exclusão.");
    }

    // Nota: Em um sistema real, aqui você deveria reverter o saldo do cliente 
    // (Ex: se deletar uma ENTRADA, deve decrementar o saldo). 
    // Mantendo apenas o delete conforme solicitado, mas fica o alerta.

    return await prisma.transacaoCliente.delete({
      where: { id },
    });
  }

  async getById(id: number) {
    if (!id) throw new BadRequestError("ID é obrigatório.");

    const transacao = await prisma.transacaoCliente.findUnique({
      where: { id },
    });

    if (!transacao) {
      throw new BadRequestError("Transação não encontrada.");
    }

    return transacao;
  }

  async getComprovanteById(id: number) {
    if (!id) throw new BadRequestError("ID da transação é obrigatório.");

    const transaction = await prisma.transacaoCliente.findUnique({
      where: { id },
      include: {
        usuario: true, // Traz dados do usuário (quem fez a transação)
      },
    });

    if (!transaction) {
      throw new BadRequestError("Comprovante não encontrado.");
    }

    return transaction;
  }

  async getAll(clienteId: number) {
    if (!clienteId) throw new BadRequestError("ID do cliente é obrigatório.");

    // Opcional: Verificar se cliente existe antes de buscar
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }});
    if (!cliente) throw new BadRequestError("Cliente não encontrado.");

    return await prisma.transacaoCliente.findMany({
      where: { clienteId },
      orderBy: { createdAt: "desc" }, // Melhor ordenar do mais recente para o mais antigo
    });
  }
}