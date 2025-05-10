import { ObjectType, Field, Int, Float } from "type-graphql";
import { TipoTransacaoCliente } from "@prisma/client";

@ObjectType()
export class ClienteTransacao {
  @Field(() => Int)
  id!: number;

  @Field(() => String)
  tipo!: TipoTransacaoCliente;

  @Field(() => Float)
  valor!: number;

  @Field(() => Float, { nullable: true })
  valorAplicado?: number;

  @Field(() => Date)
  dataTransacao!: Date;

  @Field({ nullable: true })
  fee?: string;

  @Field(() => Int)
  clienteId!: number;

  @Field(() => Int)
  usuarioId!: number;
}
