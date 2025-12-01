import { Prisma, PrismaClient } from "@prisma/client";
import { toCents } from "../../lib/toCents";

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
  const d = new Date(
    Date.UTC(startInclusive.getUTCFullYear(), startInclusive.getUTCMonth(), 1)
  );
  const end = new Date(
    Date.UTC(endInclusive.getUTCFullYear(), endInclusive.getUTCMonth(), 1)
  );
  while (d.getTime() <= end.getTime()) {
    out.push(isoMonth(d));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

/* ---------- Service ---------- */

export class InsightsService {
  private prisma = prismaSingleton;

  async PanelInsights(BMs: string[], startDate: string, endDate?: string) {
    const { gte, lt } = buildDateRangeByDay(startDate, endDate);

    const wantsAllBMs =
      Array.isArray(BMs) &&
      BMs.some((v) => String(v).trim().toLowerCase() === "bms");
    const shouldFilter = Array.isArray(BMs) && BMs.length > 0 && !wantsAllBMs;

    // ✅ Filtro correto baseado no seu schema (AdAccount.BMId -> BM.BMId)
    const whereBMs: Prisma.AdAccountWhereInput | undefined = shouldFilter
      ? { BMId: { in: BMs } }
      : // alternativa relacional (equivalente):
        // ? { BM: { is: { BMId: { in: BMs } } } }
        undefined;

    const adAccounts = await this.prisma.adAccount.findMany({
      where: whereBMs,
      select: {
        id: true,
        saldo: true, // centavos (Decimal)
        saldoMeta: true, // centavos (string)
        // Gastos SOMENTE do PERÍODO solicitado
        GastoDiario: {
          where: { data: { gte, lt } },
          select: { gasto: true }, // em REAIS
        },
      },
    });

    // Classificação baseada APENAS no período informado
    const contasAtivas = adAccounts.filter((c) => c.GastoDiario.length > 0);
    const contasInativas = adAccounts.filter((c) => c.GastoDiario.length === 0);

    const toInt = (v: unknown, fallback = 0) => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? n : fallback;
    };

    const calcularMetricas = (lista: typeof adAccounts) => {
      // Se g.gasto está em reais (number/string), converta para centavos de forma segura:
      const gastoPeriodoCentavos = lista.reduce((acc, conta) => {
        const somaContaCentavos = conta.GastoDiario.reduce((s, g) => {
          const reais = Number(g.gasto) || 0; // cuidado: pode ser string
          const cent = Math.round(reais * 100); // para centavos
          return s + cent;
        }, 0);
        return acc + somaContaCentavos;
      }, 0);

      // Se saldo é BigNumber (centavos), evite toNumber() (risco de overflow/precisão):
      // Prefira toString() -> parseInt
      const saldoTotalCentavos = lista.reduce((acc, conta) => {
        const cents =
          "toString" in conta.saldo
            ? toInt((conta.saldo as any).toString())
            : toInt(conta.saldo as any);
        return acc + cents;
      }, 0);

      // 👉 saldoMeta: somar apenas valores >= 0
      const saldoMetaCentavos = lista.reduce((acc, conta) => {
        const v = toInt(conta.saldoMeta);
        return acc + (v >= 0 ? v : 0);
      }, 0);

      return {
        quantidade: lista.length,
        gastoTotal: gastoPeriodoCentavos / 100, // reais
        saldoTotal: saldoTotalCentavos / 100, // reais
        saldoMeta: saldoMetaCentavos, // reais ou centavos, conforme sua convenção atual
      };
    };

    return {
      contasAtivas: calcularMetricas(contasAtivas),
      contasInativas: calcularMetricas(contasInativas),
      periodoUTC: { gte: gte.toISOString(), lt: lt.toISOString() },
    };
  }

  // Panel: respeita o período e calcula gasto pelo GastoDiario do intervalo (EM REAIS)
  async AdAccountInsights(
    adAccountId: string,
    startDate: string,
    endDate?: string
  ) {
    const { gte, lt } = buildDateRangeByDay(startDate, endDate);

    const adAccount = await this.prisma.adAccount.findUnique({
      where: { id: adAccountId },
      select: {
        id: true,
        nome: true,
        saldo: true, // pode vir como Decimal/number/string
        saldoMeta: true, // idem
        GastoDiario: {
          where: { data: { gte, lt } },
          select: { gasto: true }, // REAIS (number/string)
        },
      },
    });

    if (!adAccount) {
      throw new Error(`AdAccount ${adAccountId} não encontrada`);
    }

    // soma de gastos do período (REAIS -> centavos)
    const gastoPeriodoCentavos = adAccount.GastoDiario.reduce((acc, g) => {
      const s = (g.gasto as any)?.toString?.() ?? String(g.gasto ?? "0");
      const reais = Number(s.replace(",", ".")) || 0;
      return acc + Math.round(reais * 100);
    }, 0);

    // função segura para converter valores para centavos
    const toCents = (v: any) => {
      const n = Number(String(v).replace(",", ".")) || 0;
      return Math.round(n * 100);
    };

    // ----------------------------
    // 👉 Regras aplicadas:
    // saldoMeta deve ignorar valores negativos
    // ----------------------------
    const rawSaldoMeta = Number(String(adAccount.saldoMeta)) || 0;
    const saldoMetaCentavos = rawSaldoMeta >= 0 ? toCents(rawSaldoMeta) : 0;

    // saldo total mantém comportamento normal
    const saldoTotalCentavos = toCents(adAccount.saldo);

    // dias no intervalo [gte, lt)
    const msPorDia = 24 * 60 * 60 * 1000;
    const diasNoPeriodo = Math.max(
      1,
      Math.round((lt.getTime() - gte.getTime()) / msPorDia)
    );

    const gastoTotal = gastoPeriodoCentavos / 100; // REAIS
    const mediaDiaria = gastoTotal / diasNoPeriodo; // REAIS/dia
    const saldoTotal = saldoTotalCentavos / 100; // REAIS
    const saldoMeta = saldoMetaCentavos / 100; // REAIS
    const mediaDiariaFormatted = mediaDiaria.toFixed(2);

    return {
      adAccountId: adAccount.id,
      periodoUTC: { gte: gte.toISOString(), lt: lt.toISOString() },
      diasNoPeriodo,
      saldoMeta,
      gastoTotal,
      mediaDiaria: mediaDiariaFormatted,
      saldoTotal,
      nome: adAccount.nome,
    };
  }

  async Ranking(BMs: string[], startDate: string, endDate?: string) {
    const { gte, lt } = buildDateRangeByDay(startDate, endDate);

    console.log("▶️ [Ranking] Período (datas UTC):", {
      gte: gte.toISOString(),
      lt: lt.toISOString(),
    });

    // 1) Agrupa gastos no período (igual estava)
    const ranking = await this.prisma.gastoDiario.groupBy({
      by: ["contaAnuncioId"],
      where: { data: { gte, lt } },
      _sum: { gasto: true },
      orderBy: { _sum: { gasto: "desc" } },
    });

    const rankingIds = ranking.map((r) => r.contaAnuncioId);
    if (rankingIds.length === 0) return [];

    // 2) Mesma lógica de BMs
    const wantsAllBMs =
      Array.isArray(BMs) &&
      BMs.some((v) => String(v).trim().toLowerCase() === "bms");
    const shouldFilter = Array.isArray(BMs) && BMs.length > 0 && !wantsAllBMs;

    // Filtro de contas: sempre restringe aos IDs do ranking;
    // se precisar, aplica também BMId IN BMs
    const whereContas = shouldFilter
      ? { id: { in: rankingIds }, BMId: { in: BMs } }
      : { id: { in: rankingIds } };
    // (Alternativa relacional equivalente)
    // const whereContas = shouldFilter
    //   ? { id: { in: rankingIds }, BM: { is: { BMId: { in: BMs } } } }
    //   : { id: { in: rankingIds } };

    // 3) Busca as contas do ranking (com ou sem filtro de BMs)
    const contas = await this.prisma.adAccount.findMany({
      where: whereContas,
      select: {
        id: true,
        nome: true,
        moeda: true,
        fusoHorario: true,
        status: true,
        saldoMeta: true,
      },
    });

    const contasMap = new Map(contas.map((c) => [c.id, c]));

    // 4) Monta resultado apenas para contas que passaram no filtro
    const resultado = ranking
      .map((r) => {
        const conta = contasMap.get(r.contaAnuncioId);
        if (!conta) {
          console.warn(
            `⚠️ [Ranking] Conta não encontrada (fora do filtro/BM): ${r.contaAnuncioId}`
          );
          return null;
        }
        const out = {
          id: conta.id,
          nome: conta.nome,
          gastoTotal: Number(r._sum.gasto ?? 0), // em REAIS
          moeda: conta.moeda,
          fusoHorario: conta.fusoHorario,
          status: conta.status,
          saldoMeta: Number(conta.saldoMeta),
        };
        console.log("📦 [Ranking] Resultado individual:", out);
        return out;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return resultado;
  }

  async GastosPeriodos(type: PeriodType, adAccountId?: string) {
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

    // Filtro opcional por conta
    const where = {
      data: { gte, lt },
      ...(adAccountId ? { adAccountId } : {}), // <- só adiciona se vier
    };

    const registros = await this.prisma.gastoDiario.findMany({
      where: {
        data: { gte, lt },
        ...(adAccountId?.trim() ? { contaAnuncioId: adAccountId } : {}),
      },
      select: { data: true, gasto: true },
    });

    if (groupBy === "day") {
      // ---- Agrupar por DIA (YYYY-MM-DD) ----
      const mapaPorDiaISO: Record<string, number> = {};
      for (const item of registros) {
        const dayISO = isoDay(item.data); // chave estável
        mapaPorDiaISO[dayISO] =
          (mapaPorDiaISO[dayISO] || 0) + Number(item.gasto);
      }

      // Ordena categorias por ISO e depois formata rótulo dd/MM
      const startUTC = toUtcMidnight(startStr);
      const endUTC = toUtcMidnight(todayStr);
      const categoriesISO = eachDayISO(startUTC, endUTC);

      const categories = categoriesISO.map((iso) =>
        formatDayLabelUTC(toUtcMidnight(iso))
      );
      const data = categoriesISO.map((iso) => mapaPorDiaISO[iso] ?? 0); // EM REAIS

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
      const data = categoriesYM.map((ym) => mapaPorMesISO[ym] ?? 0); // EM REAIS

      return {
        data,
        categories,
        periodoUTC: { gte: gte.toISOString(), lt: lt.toISOString() },
      };
    }
  }
}
