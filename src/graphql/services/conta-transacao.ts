import { prisma } from "../../database";
import { TransacaoContaInput } from "../inputs/conta-transacao";
import { validate } from "class-validator";
import { BadRequestError } from "../errors/BadRequestError";

export class TransacaoService {
  async create(data: TransacaoContaInput) {
    const errors = await validate(data);
    if (errors.length > 0) {
      throw new BadRequestError("Dados inválidos", errors);
    }

    return await prisma.transacaoConta.create({ data });
  }

  async update(id: number, data: Partial<TransacaoContaInput>) {
    const errors = await validate(data);
    if (errors.length > 0) {
      throw new BadRequestError("Dados inválidos para atualização", errors);
    }

    return await prisma.transacaoConta.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    return await prisma.transacaoConta.delete({
      where: { id },
    });
  }

  async getById(id: number) {
    return await prisma.transacaoConta.findUnique({
      where: { id },
    });
  }

  async getAll() {
    return await prisma.transacaoConta.findMany({
      orderBy: { dataTransacao: "desc" },
    });
  }
}
