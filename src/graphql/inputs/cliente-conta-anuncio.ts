import { IsInt } from "class-validator";
import { InputType, Field, Int, registerEnumType } from "type-graphql";

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

export enum TipoTransacao {
  ENTRADA = "ENTRADA",
  REALOCACAO = "REALOCACAO",
  SAIDA = "SAIDA",
}

registerEnumType(TipoTransacao, {
  name: "TipoTransacao",
});

@InputType()
export class TransacaoClienteContaAnuncioInput {
  @Field()
  usuarioId!: number;

  @Field()
  clienteId!: number; // Adicionado clienteId

  @Field(() => TipoTransacao)
  tipo!: TipoTransacao;

  @Field()
  valor!: string;

  @Field({ nullable: true })
  contaOrigemId?: number;

  @Field({ nullable: true })
  contaDestinoId?: number;
}