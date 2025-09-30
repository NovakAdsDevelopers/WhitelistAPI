import { ObjectType, Field, Float, Int, GraphQLISODateTime } from "type-graphql";

@ObjectType()
export class InsightsPanel {
  @Field(() => Int)
  quantidade!: number;

  @Field(() => Float)
  gastoTotal!: number;

  @Field(() => Float)
  saldoTotal!: number;

  @Field(() => Float)
  saldoMeta!: number;
}

@ObjectType()
export class PanelInsightsResponse {
  @Field(() => InsightsPanel)
  contasAtivas!: InsightsPanel;

  @Field(() => InsightsPanel)
  contasInativas!: InsightsPanel;
}

@ObjectType()
export class RankingContasPeriodo {
  @Field()
  id!: string;

  @Field()
  nome!: string;

  @Field(() => Float)
  gastoTotal!: number;

  @Field({ nullable: true })
  moeda?: string;
  
  @Field({ nullable: true })
  saldoMeta?: string;

  @Field({ nullable: true })
  fusoHorario?: string;

  @Field({ nullable: true })
  status?: number;
}

@ObjectType()
export class GastosPeriodosResponse {
  @Field(() => [String])
  categories!: string[];

  @Field(() => [Float])
  data!: number[];
}

@ObjectType()
export class PeriodoUTC {
  @Field(() => GraphQLISODateTime, { description: 'Início do período (UTC, inclusive)' })
  gte!: Date;

  @Field(() => GraphQLISODateTime, { description: 'Fim do período (UTC, exclusivo)' })
  lt!: Date;
}

@ObjectType()
export class PanelInsightsAdAccountResponse {
  @Field(() => String, { description: 'ID da conta de anúncio' })
  adAccountId!: string;

  @Field(() => String, { description: 'Nome da conta de anúncio' })
  nome!: string;

  @Field(() => PeriodoUTC, { description: 'Período considerado (UTC)' })
  periodoUTC!: PeriodoUTC;

  @Field(() => Int, { description: 'Quantidade de dias no período [gte, lt)' })
  diasNoPeriodo!: number;

  @Field(() => Float, { description: 'Saldo meta (em reais)' })
  saldoMeta!: number;

  @Field(() => Float, { description: 'Gasto total no período (em reais)' })
  gastoTotal!: number;

  @Field(() => Float, { description: 'Média diária de gasto no período (em reais/dia)' })
  mediaDiaria!: number;

  @Field(() => Float, { description: 'Saldo total atual (em reais)' })
  saldoTotal!: number;
}