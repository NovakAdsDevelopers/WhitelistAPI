import { InputType, Field, Int } from "type-graphql";

@InputType()
export class ClienteContaAnuncioCreateInput {

  @Field()
  contaAnuncioId!: string;

  @Field()
  inicioAssociacao!: Date;

  @Field({ nullable: true })
  fimAssociacao?: Date;
}

@InputType()
export class ClienteContaAnuncioCreateManyInput {
  @Field()
  clienteId!: number;

  @Field(() => [ClienteContaAnuncioCreateInput])
  contas!: ClienteContaAnuncioCreateInput[];
}