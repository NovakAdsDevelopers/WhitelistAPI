import { ObjectType, Field, Float } from "type-graphql";

@ObjectType()
export class ContaGastoTotal {
  @Field(() => Float)
  gastoTotal!: number;
}
