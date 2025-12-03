import "reflect-metadata";
import {
  Resolver,
  Query,
  Arg,
  Int,
  ObjectType,
  Field,
  Float,
} from "type-graphql";
import { PrismaClient, Prisma } from "@prisma/client";

// O prismaSingleton deve vir de um arquivo de configuração,
// mas para o contexto deste arquivo, vamos inicializá-lo:
const prisma = new PrismaClient();

// =============================================================
//  MODELS GRAPHQL (Type-GraphQL Object Types)
// =============================================================

@ObjectType()
export class RankingContaResponse {
  @Field(() => String)
  id!: string;

  @Field()
  nome!: string;

  @Field(() => Float)
  gastoTotal!: number;

  @Field()
  moeda!: string;

  @Field(() => Int) // <- CORREÇÃO: Usando Int para Status
  status!: number;

  @Field()
  fusoHorario!: string;

  @Field(() => Float)
  saldoMeta!: number;
}

@ObjectType()
export class GastosContasPeriodosResponse {
  @Field(() => [Float])
  data!: number[];

  @Field(() => [String])
  categories!: string[];

  // Mantendo o formato de string ISO
  @Field(() => String)
  periodoGte!: string;

  @Field(() => String)
  periodoLt!: string;
}

// =============================================================
//  SERVICE (Lógica de Negócio e Acesso a Dados)
// =============================================================

/**
 * Serviço responsável por buscar dados consolidados (Ranking e Gráfico)
 * apenas para as contas ativas associadas a um Cliente específico.
 */
// 🛠️ HELPER: Converte DD/MM/YYYY para YYYY-MM-DD
function formatDataToISO(dataBR?: string): string | undefined {
  if (!dataBR) return undefined;
  if (dataBR.includes("-")) return dataBR; // Já é ISO

  const [dia, mes, ano] = dataBR.split("/");
  if (!dia || !mes || !ano) return undefined;

  return `${ano}-${mes}-${dia}`;
}

export class ClientePanelService {
  private prisma = prisma;

  // --------------------------------------------------------------
  //  1) RANKING DO CLIENTE
  // --------------------------------------------------------------
  async RankingCliente(
    clienteId: number,
    startDate?: string,
    endDate?: string
  ): Promise<RankingContaResponse[]> {
    
    // 1. Converte inputs (DD/MM/YYYY) para ISO (YYYY-MM-DD)
    const startISO = formatDataToISO(startDate);
    const endISO = formatDataToISO(endDate);

    // 2. Se não informar data, pega o dia de hoje (YYYY-MM-DD)
    const dataInicial = startISO || new Date().toISOString().split("T")[0];

    // 3. Gera o range de datas usando ISO
    const { gte, lt } = buildDateRangeByDay(dataInicial, endISO);

    // 4. Buscar contas ativas associadas ao cliente
    const vinculos = await this.prisma.clienteContaAnuncio.findMany({
      where: {
        clienteId,
        ativo: true,
        historico: false,
      },
      select: { contaAnuncioId: true },
    });

    const contasCliente = vinculos.map((v) => v.contaAnuncioId);
    if (contasCliente.length === 0) return [];

    // 5. Agrupar gastos do período
    const ranking = await this.prisma.gastoDiario.groupBy({
      by: ["contaAnuncioId"],
      where: {
        contaAnuncioId: { in: contasCliente },
        data: { gte, lt },
      },
      _sum: { gasto: true },
      orderBy: { _sum: { gasto: "desc" } },
    });

    const contasIds = ranking.map((r) => r.contaAnuncioId);

    // 6. Carregar detalhes das contas
    const contas = await this.prisma.adAccount.findMany({
      where: { id: { in: contasIds } },
      select: {
        id: true,
        nome: true,
        moeda: true,
        status: true,
        fusoHorario: true,
        saldoMeta: true,
      },
    });

    const contasMap = new Map(contas.map((c) => [c.id, c]));

    // 7. Mapear resposta
    return ranking
      .map((r) => {
        const c = contasMap.get(r.contaAnuncioId);
        if (!c) return null;

        return {
          id: c.id,
          nome: c.nome,
          gastoTotal: Number(r._sum.gasto ?? 0),
          moeda: c.moeda,
          status: c.status,
          fusoHorario: c.fusoHorario,
          saldoMeta: Number(c.saldoMeta ?? 0),
        };
      })
      .filter((r): r is RankingContaResponse => r !== null);
  }

  // --------------------------------------------------------------
  // 2) GASTO AGRUPADO POR DIA OU MÊS
  // --------------------------------------------------------------
  async GastosPeriodosCliente(
    clienteId: number,
    type: "week" | "month" | "three-month" | "year"
  ): Promise<GastosContasPeriodosResponse> {
    const today = isoDay(new Date());

    let startStr: string;
    let groupBy: "day" | "month";

    switch (type) {
      case "week":
        startStr = addDaysToDateStr(today, -6);
        groupBy = "day";
        break;

      case "month":
        startStr = isoDay(firstDayOfMonthUTC(today));
        groupBy = "day";
        break;

      case "three-month":
        startStr = isoDay(firstDayOfPastMonthsUTC(today, 2));
        groupBy = "month";
        break;

      case "year":
        startStr = isoDay(firstDayOfYearUTC(today));
        groupBy = "month";
        break;

      default:
        throw new Error("Tipo de período inválido");
    }

    const { gte, lt } = buildDateRangeByDay(startStr, today);

    // 1) Buscar contas ativas do cliente
    const vinculos = await this.prisma.clienteContaAnuncio.findMany({
      where: { clienteId, ativo: true, historico: false },
      select: { contaAnuncioId: true },
    });

    const contasCliente = vinculos.map((v) => v.contaAnuncioId);
    
    // Retorno vazio se não tiver contas
    if (contasCliente.length === 0) {
      return {
        data: [],
        categories: [],
        periodoGte: gte.toISOString(),
        periodoLt: lt.toISOString(),
      };
    }

    // 2) Buscar gastos
    const registros = await this.prisma.gastoDiario.findMany({
      where: {
        contaAnuncioId: { in: contasCliente },
        data: { gte, lt },
      },
      select: { data: true, gasto: true },
    });

    // --------- AGRUPAMENTO POR DIA ---------
    if (groupBy === "day") {
      const mapa: Record<string, number> = {};

      for (const r of registros) {
        const iso = isoDay(r.data);
        mapa[iso] = (mapa[iso] || 0) + Number(r.gasto);
      }

      const dias = eachDayISO(startStr, today);
      const categories = dias.map((d) => formatDayBR(d));
      const data = dias.map((d) => mapa[d] ?? 0);

      return {
        data,
        categories,
        periodoGte: gte.toISOString(),
        periodoLt: lt.toISOString(),
      };
    }

    // --------- AGRUPAMENTO POR MÊS ---------
    const mapaMes: Record<string, number> = {};

    for (const r of registros) {
      const ym = isoMonth(r.data);
      mapaMes[ym] = (mapaMes[ym] || 0) + Number(r.gasto);
    }

    const meses = eachMonthISO(startStr, today);
    const categories = meses.map((m) => formatMonthShortBR(m));
    const data = meses.map((m) => mapaMes[m] ?? 0);

    return {
      data,
      categories,
      periodoGte: gte.toISOString(),
      periodoLt: lt.toISOString(),
    };
  }
}

// =============================================================
// RESOLVER (Type-GraphQL)
// =============================================================

@Resolver()
export class ClientePanelResolver {
  private service = new ClientePanelService();

  /**
   * Retorna o ranking das contas de anúncio de um cliente, ordenadas pelo gasto total
   * no período especificado.
   */
@Query(() => [RankingContaResponse], {
    description:
      "Ranking de contas de anúncio de um cliente, filtrado por período de gasto.",
  })
  async RankingContasCliente(
    @Arg("clienteId", () => Int) clienteId: number,
    @Arg("startDate", { nullable: true }) startDate?: string, // 👈 Adicionado { nullable: true } e tipagem opcional (?)
    @Arg("endDate", { nullable: true }) endDate?: string
  ) {
    // Se startDate for undefined, o service vai assumir a data de hoje
    return this.service.RankingCliente(clienteId, startDate, endDate);
  }

  /**
   * Retorna os gastos totais consolidados das contas do cliente, agrupados por dia,
   * mês, ou nos últimos 3 meses/ano, para exibição em gráficos.
   */
  @Query(() => GastosContasPeriodosResponse, {
    description:
      "Gastos totais consolidados do cliente por dia (week/month) ou por mês (three-month/year).",
  })
  async GastosContasPeriodoCliente(
    @Arg("clienteId", () => Int) clienteId: number,
    // Use um Enum GraphQL na produção, mas 'string' funciona para prototipagem rápida.
    @Arg("type") type: "week" | "month" | "three-month" | "year"
  ) {
    return this.service.GastosPeriodosCliente(clienteId, type);
  }
}

// =============================================================
//  FUNÇÕES AUXILIARES (DATAS)
//  NOTA: Estas funções assumem que 'start' e 'end' são datas ISO
//        em UTC (YYYY-MM-DD) e operam em UTC.
// =============================================================

function buildDateRangeByDay(start: string, end?: string) {
  // gte: Início do dia 00:00:00.000Z
  const gte = new Date(start + "T00:00:00.000Z");
  // lt: Início do dia seguinte (ou do dia 'end' + 1) 00:00:00.000Z
  const lt = end
    ? new Date(new Date(end + "T00:00:00.000Z").getTime() + 86400000)
    : new Date(new Date(start + "T00:00:00.000Z").getTime() + 86400000);
  return { gte, lt };
}

function isoDay(date: Date | string) {
  const d = new Date(date);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function isoMonth(date: Date | string) {
  const d = new Date(date);
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function eachDayISO(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const out: string[] = [];
  while (s <= e) {
    out.push(isoDay(s));
    s.setUTCDate(s.getUTCDate() + 1);
  }
  return out;
}

function eachMonthISO(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const out: string[] = [];
  while (s <= e) {
    out.push(isoMonth(s));
    s.setUTCMonth(s.getUTCMonth() + 1);
  }
  return out;
}

function addDaysToDateStr(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDay(d);
}

function firstDayOfMonthUTC(dateStr: string) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function firstDayOfPastMonthsUTC(dateStr: string, monthsBack: number) {
  const d = new Date(dateStr);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsBack, 1)
  );
}

function firstDayOfYearUTC(dateStr: string) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function formatDayBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function formatMonthShortBR(ym: string) {
  const [y, m] = ym.split("-");
  const labels = [
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
  return labels[Number(m) - 1];
}
