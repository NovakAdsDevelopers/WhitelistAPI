import { InputType, Field, Int, Float } from "type-graphql";
import { IsEnum, IsNumber, IsInt } from "class-validator";
import { TipoTransacaoCliente } from "@prisma/client";
import { TipoTransacaoConta } from "../enum/TransaçãoConta";

@InputType()
export class TransacaoContaInput {
  @Field(() => String)
  @IsEnum(TipoTransacaoCliente)
  tipo!: TipoTransacaoCliente;

  @Field(() => Float)
  @IsNumber()
  valor!: number;

  @Field(() => Int)
  @IsInt()
  clienteId!: number;

  @Field(() => Int)
  @IsInt()
  usuarioId!: number;
}



@InputType()
export class CreateTransacaoContaInput {
  @Field(() => TipoTransacaoConta)
  tipo!: TipoTransacaoConta;

  @Field()
  valor!: number;

  @Field(() => String, { nullable: true })
  contaOrigemId?: string;

  @Field(() => String, { nullable: true })
  contaDestinoId?: string;

  @Field(() => Int)
  usuarioId!: number;
}
