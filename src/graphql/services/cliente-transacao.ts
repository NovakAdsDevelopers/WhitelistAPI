import { prisma } from "../../database";
import { TransacaoClienteInput } from "../inputs/cliente-transacao";
import { validate } from "class-validator";
import { BadRequestError } from "../errors/BadRequestError";
import { Decimal } from "@prisma/client/runtime/library";

export class TransacaoService {
  async create(data: TransacaoClienteInput) {
    const errors = await validate(data);
    if (errors.length > 0) {
      throw new BadRequestError("Dados inválidos", errors);
    }

    // Se for SAÍDA, verifica se há saldo suficiente
    if (data.tipo === "SAIDA") {
      const cliente = await prisma.cliente.findUnique({
        where: { id: data.clienteId },
        select: { saldo: true },
      });

      if (!cliente) {
        throw new BadRequestError("Cliente não encontrado", []);
      }

      if (new Decimal(data.valor).gt(cliente.saldo)) {
        throw new BadRequestError(
          "Saldo insuficiente para realizar a transação",
          []
        );
      }
    }

    const transacao = await prisma.transacaoCliente.create({ data });

    if (data.tipo === "ENTRADA") {
      await prisma.cliente.update({
        where: { id: data.clienteId },
        data: {
          saldo: { increment: data.valorAplicado },
          depositoTotal: { increment: data.valorAplicado },
        },
      });
    }

    if (data.tipo === "SAIDA") {
      await prisma.cliente.update({
        where: { id: data.clienteId },
        data: {
          saldo: { decrement: data.valor },
        },
      });
    }

    return transacao;
  }

  async update(id: number, data: Partial<TransacaoClienteInput>) {
    const errors = await validate(data);
    if (errors.length > 0) {
      throw new BadRequestError("Dados inválidos para atualização", errors);
    }

    return await prisma.transacaoCliente.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    return await prisma.transacaoCliente.delete({
      where: { id },
    });
  }

  async getById(id: number) {
    return await prisma.transacaoCliente.findUnique({
      where: { id },
    });
  }

  async getAll(clienteId: number) {
    return await prisma.transacaoCliente.findMany({
      where: { clienteId },
      orderBy: { createdAt: "asc" }, 
    });
  }
}
