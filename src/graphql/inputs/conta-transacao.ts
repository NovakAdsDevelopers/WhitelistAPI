import { InputType, Field, Int, Float } from "type-graphql";
import { IsEnum, IsNumber, IsInt } from "class-validator";
import { TipoTransacaoCliente } from "@prisma/client";

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
