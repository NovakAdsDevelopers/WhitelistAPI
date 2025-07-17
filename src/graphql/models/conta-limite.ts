import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class ContaLimiteModel {
  @Field()
  contaAnuncioID!: string;

  @Field()
  limiteCritico!: string;

  @Field()
  limiteMedio!: string;

  @Field()
  limiteInicial!: string;

  @Field()
  alertaAtivo!: boolean;
}
