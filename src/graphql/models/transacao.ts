import { ObjectType, Field, Int, Float } from "type-graphql";
import { TipoTransacao } from "@prisma/client";

@ObjectType()
export class Transacao {
  @Field(() => Int)
  id!: number;

  @Field(() => String)
  tipo!: TipoTransacao;

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
