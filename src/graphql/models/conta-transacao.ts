import { ObjectType, Field, Int, Float } from "type-graphql";
import { TipoTransacaoConta } from "@prisma/client";

@ObjectType()
export class ContaTransacao {
  @Field(() => Int)
  id!: number;

  @Field(() => String)
  tipo!: TipoTransacaoConta;

  @Field(() => Float)
  valor!: number;

  @Field(() => Date)
  dataTransacao!: Date;

  @Field({ nullable: true })
  descricao?: string;

  @Field(() => Int)
  clienteId!: number;

  @Field({ nullable: true })
  contaOrigemId?: string;

  @Field({ nullable: true })
  contaDestinoId?: string;

  @Field(() => Int)
  usuarioId!: number;
}
