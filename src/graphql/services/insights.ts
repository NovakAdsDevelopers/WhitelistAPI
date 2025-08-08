import { PrismaClient } from "@prisma/client";

type PeriodType = "week" | "mounth" | "tree-mouth" | "year";

const prismaSingleton = new PrismaClient();

/* ---------- Utils de data (UTC, sem libs) ---------- */

function isoDay(date: Date): string {
  // "2025-08-08"
  return date.toISOString().slice(0, 10);
}

function toUtcMidnight(dateStrYYYYMMDD: string): Date {
  // "2025-08-08" -> 2025-08-08T00:00:00.000Z
  return new Date(`${dateStrYYYYMMDD}T00:00:00.000Z`);
}

function addDaysToDateStr(dateStrYYYYMMDD: string, days: number): string {
  const d = toUtcMidnight(dateStrYYYYMMDD);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDay(d);
}

function buildDateRangeByDay(
  startISO: string,
  endISO?: string
): { gte: Date; lt: Date } {
  // Recebe strings ISO (com ou sem "Z"). Corta para "YYYY-MM-DD".
  const startDay = startISO.split("T")[0]; // "YYYY-MM-DD"
  const endDay = (endISO ?? startISO).split("T")[0];

  const gte = toUtcMidnight(startDay);
  // intervalo exclusivo no fim (dia seguinte 00:00Z)
  const endNextDay = addDaysToDateStr(endDay, 1);
  const lt = toUtcMidnight(endNextDay);

  return { gte, lt };
}

// Avança um dia UTC
function addUtcDays(d: Date, days: number): Date {
  const nd = new Date(d.getTime());
  nd.setUTCDate(nd.getUTCDate() + days);
  return nd;
}

/* ---------- Helpers de rótulos ---------- */

function formatDayLabelUTC(d: Date): string {
  // dd/MM usando UTC
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

const PT_BR_MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function monthShortLabelUTC(d: Date): string {
  return PT_BR_MONTHS_SHORT[d.getUTCMonth()];
}

function isoMonth(date: Date): string {
  // "YYYY-MM"
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function eachDayISO(startInclusive: Date, endInclusive: Date): string[] {
  const out: string[] = [];
  const d = new Date(startInclusive.getTime());
  while (d.getTime() <= endInclusive.getTime()) {
    out.push(isoDay(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function eachMonthISO(startInclusive: Date, endInclusive: Date): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(startInclusive.getUTCFullYear(), startInclusive.getUTCMonth(), 1));
  const end = new Date(Date.UTC(endInclusive.getUTCFullYear(), endInclusive.getUTCMonth(), 1));
  while (d.getTime() <= end.getTime()) {
    out.push(isoMonth(d));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

/* ---------- Service ---------- */

export class InsightsService {
  private prisma = prismaSingleton;

  // Panel: respeita o período e calcula gasto pelo GastoDiario do intervalo (EM REAIS)
async PanelInsights(startDate: string, endDate?: string) {
  const { gte, lt } = buildDateRangeByDay(startDate, endDate);

  // Janela de 7 dias baseada no endDate (inclui o dia do endDate)
  const end = endDate ? new Date(endDate) : new Date();
  // Normaliza pra meia-noite UTC do dia seguinte pra usar como "lt" exclusivo
  const endDayStartUTC = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 0, 0, 0, 0));
  const last7Gte = new Date(endDayStartUTC); last7Gte.setUTCDate(last7Gte.getUTCDate() - 6); // volta 6 dias
  const last7Lt = new Date(endDayStartUTC); last7Lt.setUTCDate(last7Lt.getUTCDate() + 1);     // exclusivo: dia seguinte

  const adAccounts = await this.prisma.adAccount.findMany({
    select: {
      id: true,
      saldo: true,      // centavos (Decimal)
      saldoMeta: true,  // centavos (string)
      // Gastos do PERÍODO solicitado (para métricas)
      GastoDiario: {
        where: { data: { gte, lt } },
        select: { gasto: true }, // em REAIS
      },
      // Usa a MESMA relação com _count para classificar (7 dias até endDate)
      _count: {
        select: {
          GastoDiario: {
            where: { data: { gte: last7Gte, lt: last7Lt } }, // 7 dias (inclusive endDate)
          },
        },
      },
    },
  });

  const contasAtivas = adAccounts.filter((c) => c._count.GastoDiario > 0);
  const contasInativas = adAccounts.filter((c) => c._count.GastoDiario === 0);

  const calcularMetricas = (lista: typeof adAccounts) => {
    const gastoPeriodoReais = lista.reduce((acc, conta) => {
      const somaConta = conta.GastoDiario.reduce((s, g) => s + Number(g.gasto), 0);
      return acc + somaConta;
    }, 0);

    const saldoTotalCentavos = lista.reduce((acc, conta) => acc + conta.saldo.toNumber(), 0);
    const saldoMetaCentavos = lista.reduce((acc, conta) => acc + parseFloat(conta.saldoMeta), 0);

    return {
      quantidade: lista.length,
      gastoTotal: gastoPeriodoReais,       // já em reais
      saldoTotal: saldoTotalCentavos / 100,
      saldoMeta: saldoMetaCentavos / 100,
    };
  };

  return {
    contasAtivas: calcularMetricas(contasAtivas),
    contasInativas: calcularMetricas(contasInativas),
    periodoUTC: { gte: gte.toISOString(), lt: lt.toISOString() },
    janelaClassificacao7dUTC: { gte: last7Gte.toISOString(), lt: last7Lt.toISOString() },
  };
}



  async Ranking(startDate: string, endDate?: string) {
    const { gte, lt } = buildDateRangeByDay(startDate, endDate);

    console.log("▶️ [Ranking] Período (datas UTC):", {
      gte: gte.toISOString(),
      lt: lt.toISOString(),
    });

    const ranking = await this.prisma.gastoDiario.groupBy({
      by: ["contaAnuncioId"],
      where: { data: { gte, lt } },
      _sum: { gasto: true },
      orderBy: { _sum: { gasto: "desc" } },
      take: 25,
    });

    const contas = await this.prisma.adAccount.findMany({
      where: { id: { in: ranking.map((r) => r.contaAnuncioId) } },
      select: {
        id: true,
        nome: true,
        moeda: true,
        fusoHorario: true,
        status: true,
      },
    });

    const contasMap = new Map(contas.map((c) => [c.id, c]));
    const resultado = ranking
      .map((r) => {
        const conta = contasMap.get(r.contaAnuncioId);
        if (!conta) {
          console.warn(`⚠️ [Ranking] Conta não encontrada: ${r.contaAnuncioId}`);
          return null;
        }
        const out = {
          id: conta.id,
          nome: conta.nome,
          gastoTotal: Number(r._sum.gasto ?? 0), // em REAIS
          moeda: conta.moeda,
          fusoHorario: conta.fusoHorario,
          status: conta.status,
        };
        console.log("📦 [Ranking] Resultado individual:", out);
        return out;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return resultado;
  }

  // Mantendo as chaves originais ("mounth", "tree-mouth")
  async GastosPeriodos(type: PeriodType) {
    // Hoje por DATA (UTC)
    const todayStr = isoDay(new Date());

    let startStr: string;
    let groupBy: "day" | "month";

    switch (type) {
      case "week": {
        startStr = addDaysToDateStr(todayStr, -6); // últimos 7 dias incluindo hoje
        groupBy = "day";
        break;
      }
      case "mounth": {
        const today = toUtcMidnight(todayStr);
        const firstOfMonth = new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
        );
        startStr = isoDay(firstOfMonth);
        groupBy = "day";
        break;
      }
      case "tree-mouth": {
        const today = toUtcMidnight(todayStr);
        const firstTwoMonthsAgo = new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1)
        );
        startStr = isoDay(firstTwoMonthsAgo);
        groupBy = "month";
        break;
      }
      case "year": {
        const today = toUtcMidnight(todayStr);
        const firstOfYear = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
        startStr = isoDay(firstOfYear);
        groupBy = "month";
        break;
      }
      default:
        throw new Error("Tipo de período inválido");
    }

    // Janela por data: [gte start, lt end+1dia]
    const { gte, lt } = buildDateRangeByDay(startStr, todayStr);

    const registros = await this.prisma.gastoDiario.findMany({
      where: { data: { gte, lt } },
      select: { data: true, gasto: true }, // gasto EM REAIS
    });

    if (groupBy === "day") {
      // ---- Agrupar por DIA (YYYY-MM-DD) ----
      const mapaPorDiaISO: Record<string, number> = {};
      for (const item of registros) {
        const dayISO = isoDay(item.data); // chave estável
        mapaPorDiaISO[dayISO] = (mapaPorDiaISO[dayISO] || 0) + Number(item.gasto);
      }

      // Ordena categorias por ISO e depois formata rótulo dd/MM
      const startUTC = toUtcMidnight(startStr);
      const endUTC = toUtcMidnight(todayStr);
      const categoriesISO = eachDayISO(startUTC, endUTC);

      const categories = categoriesISO.map((iso) => formatDayLabelUTC(toUtcMidnight(iso)));
      const data = categoriesISO.map((iso) => (mapaPorDiaISO[iso] ?? 0)); // EM REAIS

      return {
        data,
        categories,
        periodoUTC: { gte: gte.toISOString(), lt: lt.toISOString() },
      };
    } else {
      // ---- Agrupar por MÊS (YYYY-MM) ----
      const mapaPorMesISO: Record<string, number> = {};
      for (const item of registros) {
        const ym = isoMonth(item.data);
        mapaPorMesISO[ym] = (mapaPorMesISO[ym] || 0) + Number(item.gasto);
      }

      const startUTC = toUtcMidnight(startStr);
      const endUTC = toUtcMidnight(todayStr);
      const categoriesYM = eachMonthISO(startUTC, endUTC); // ["YYYY-MM", ...]

      const categories = categoriesYM.map((ym) => {
        const [y, m] = ym.split("-").map(Number);
        return monthShortLabelUTC(new Date(Date.UTC(y, m - 1, 1))); // "jan", "fev", ...
      });
      const data = categoriesYM.map((ym) => (mapaPorMesISO[ym] ?? 0)); // EM REAIS
      return {
        data,
        categories,
        periodoUTC: { gte: gte.toISOString(), lt: lt.toISOString() },
      };
    }
  }
}
