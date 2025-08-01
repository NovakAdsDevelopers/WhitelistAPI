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