import { PrismaClient } from "@prisma/client";
import axios from "axios";

export class GastoDiarioService {
  private prisma = new PrismaClient();

  async calcularGastoTotalPorPeriodo(
    account_id: string,
    startDate: string,
    endDate?: string
  ): Promise<number> {
    const dataInicio = new Date(startDate);
    const dataFim = endDate ? new Date(endDate) : new Date();

    dataInicio.setHours(0, 0, 0, 0);
    dataFim.setHours(23, 59, 59, 999);

    const adAccount = await this.prisma.adAccount.findUnique({
      where: { id: account_id },
    });

    if (!adAccount) {
      throw new Error(
        `Conta de anúncio com ID '${account_id}' não encontrada.`
      );
    }

    const resultado = await this.prisma.gastoDiario.aggregate({
      _sum: {
        gasto: true,
      },
      where: {
        contaAnuncioId: adAccount.id,
        data: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
    });

    return resultado._sum.gasto?.toNumber() ?? 0;
  }
}
