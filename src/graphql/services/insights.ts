import { PrismaClient } from "@prisma/client";
import {
  subDays,
  subMonths,
  startOfMonth,
  startOfYear,
  format,
  eachDayOfInterval,
  eachMonthOfInterval
} from "date-fns";
import { ptBR } from 'date-fns/locale';



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

  async Ranking(startDate: string, endDate?: string) {
    const dataInicio = new Date(startDate);
    const dataFim = endDate ? new Date(endDate) : new Date();

    dataInicio.setHours(0, 0, 0, 0);
    dataFim.setHours(23, 59, 59, 999);

    console.log("▶️ [Ranking] Período:", {
      dataInicio: dataInicio.toISOString(),
      dataFim: dataFim.toISOString(),
    });

    const ranking = await this.prisma.gastoDiario.groupBy({
      by: ["contaAnuncioId"],
      where: {
        data: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      _sum: {
        gasto: true,
      },
      orderBy: {
        _sum: {
          gasto: "desc",
        },
      },
      take: 25,
    });

    console.log("📊 [Ranking] Resultado do groupBy:", ranking);

    const contas = await this.prisma.adAccount.findMany({
      where: {
        id: {
          in: ranking.map((r) => r.contaAnuncioId),
        },
      },
      select: {
        id: true,
        nome: true,
        moeda: true,
        fusoHorario: true,
        status: true,
      },
    });

    console.log("✅ [Ranking] Contas encontradas no findMany:", contas);

    const contasMap = new Map(contas.map((conta) => [conta.id, conta]));

    const resultado = ranking
      .map((r) => {
        const conta = contasMap.get(r.contaAnuncioId);
        if (!conta) {
          console.warn(
            `⚠️ [Ranking] Conta não encontrada para ID: ${r.contaAnuncioId}`
          );
          return null;
        }

        const resultadoConta = {
          id: conta.id,
          nome: conta.nome,
          gastoTotal: Number(r._sum.gasto ?? 0),
          moeda: conta.moeda,
          fusoHorario: conta.fusoHorario,
          status: conta.status,
        };

        console.log("📦 [Ranking] Resultado individual:", resultadoConta);

        return resultadoConta;
      })
      .filter((item): item is Exclude<typeof item, null> => item !== null);

    console.log("✅ [Ranking] Resultado final:", resultado);

    return resultado;
  }

  async GastosPeriodos(type: "week" | "mounth" | "tree-mouth" | "year") {
    const today = new Date();
    let startDate: Date;
    let groupBy: "day" | "month";

    switch (type) {
      case "week":
        startDate = subDays(today, 6);
        groupBy = "day";
        break;
      case "mounth":
        startDate = startOfMonth(today);
        groupBy = "day";
        break;
      case "tree-mouth":
        startDate = startOfMonth(subMonths(today, 2));
        groupBy = "month";
        break;
      case "year":
        startDate = startOfYear(today);
        groupBy = "month";
        break;
      default:
        throw new Error("Tipo de período inválido");
    }

    // Busca os dados de gasto dentro do período
    const registros = await this.prisma.gastoDiario.findMany({
      where: {
        data: {
          gte: startDate,
          lte: today,
        },
      },
      select: {
        data: true,
        gasto: true,
      },
    });

    // Agrupando os gastos por período
    const mapa: Record<string, number> = {};

    for (const item of registros) {
      const chave =
        groupBy === "day"
          ? format(item.data, "dd/MM", { locale: ptBR })
          : format(item.data, "MMM", { locale: ptBR });

      mapa[chave] = (mapa[chave] || 0) + Number(item.gasto);
    }

    // Garantindo que todos os períodos estejam presentes com valor 0 se não houver dados
    const categories =
      groupBy === "day"
        ? eachDayOfInterval({ start: startDate, end: today }).map((date) =>
            format(date, "dd/MM", { locale: ptBR })
          )
        : eachMonthOfInterval({ start: startDate, end: today }).map((date) =>
            format(date, "MMM", { locale: ptBR })
          );

    const data = categories.map((label) => (mapa[label] ?? 0) / 100); // centavos → reais

    return {
      data,
      categories,
    };
  }
}
