import { InputType, Field } from "type-graphql";

@InputType()
export class ContasAnuncioInput {
  @Field()
  id!: string; 

  @Field()
  nome!: string;

  @Field()
  status!: number;

  @Field()
  moeda!: string;

  @Field()
  fusoHorario!: string; 

  @Field()
  gastoTotal!: string; 

  @Field()
  gastoAPI!: string; 

  @Field()
  limiteGasto!: string; 

  @Field()
  saldoMeta!: string; 

  @Field()
  ultimaSincronizacao!: string; 
}
