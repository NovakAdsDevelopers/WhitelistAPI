import { PrismaClient } from "@prisma/client";

export class InsightsService {
  private prisma = new PrismaClient();

  async PanelInsights(startDate: string, endDate?: string) {
    const dataInicio = new Date(startDate);
    const dataFim = endDate ? new Date(endDate) : new Date();

    dataInicio.setHours(0, 0, 0, 0);
    dataFim.setHours(23, 59, 59, 999);

    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    seteDiasAtras.setHours(0, 0, 0, 0);

    const adAccounts = await this.prisma.adAccount.findMany({
      include: {
        GastoDiario: {
          where: {
            data: {
              gte: seteDiasAtras,
            },
          },
        },
      },
    });

    const contasAtivas = adAccounts.filter(
      (conta) => conta.GastoDiario.length > 0
    );

    const contasInativas = adAccounts.filter(
      (conta) => conta.GastoDiario.length === 0
    );

    const calcularMetricas = (lista: typeof adAccounts) => {
      const gastoTotal = lista.reduce(
        (acc, conta) => acc + conta.gastoTotal.toNumber(),
        0
      ); // centavos

      const saldoTotal = lista.reduce(
        (acc, conta) => acc + conta.saldo.toNumber(),
        0
      ); // reais

      const saldoMeta = lista.reduce(
        (acc, conta) => acc + parseFloat(conta.saldoMeta),
        0
      );

      return {
        quantidade: lista.length,
        gastoTotal: gastoTotal / 100,
        saldoTotal: saldoTotal / 100,
        saldoMeta: saldoMeta / 100, // Convertendo centavos para reais
      };
    };

    return {
      contasAtivas: calcularMetricas(contasAtivas),
      contasInativas: calcularMetricas(contasInativas),
    };
  }
}
