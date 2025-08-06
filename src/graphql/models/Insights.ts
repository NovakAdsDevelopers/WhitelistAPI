import { ObjectType, Field, Float, Int } from "type-graphql";

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