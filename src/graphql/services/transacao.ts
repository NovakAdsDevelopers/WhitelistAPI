import { prisma } from "../../database";
import { TransacaoInput } from "../inputs/transacao";
import { validate } from "class-validator";
import { BadRequestError } from "../errors/BadRequestError";

export class TransacaoService {
  async create(data: TransacaoInput) {
    const errors = await validate(data);
    if (errors.length > 0) {
      throw new BadRequestError("Dados inválidos", errors);
    }

    return await prisma.transacao.create({ data });
  }

  async update(id: number, data: Partial<TransacaoInput>) {
    const errors = await validate(data);
    if (errors.length > 0) {
      throw new BadRequestError("Dados inválidos para atualização", errors);
    }

    return await prisma.transacao.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    return await prisma.transacao.delete({
      where: { id },
    });
  }

  async getById(id: number) {
    return await prisma.transacao.findUnique({
      where: { id },
    });
  }

  async getAll() {
    return await prisma.transacao.findMany({
      orderBy: { dataTransacao: "desc" },
    });
  }
}
