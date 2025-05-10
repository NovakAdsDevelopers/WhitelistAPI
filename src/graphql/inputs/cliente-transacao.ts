import { InputType, Field, Int, Float } from "type-graphql";
import {
  IsEnum,
  IsNumber,
  IsInt,
  IsDate,
  IsString,
  IsOptional,
} from "class-validator";
import { TipoTransacaoCliente } from "@prisma/client";

@InputType()
export class TransacaoClienteInput {
  @Field(() => String)
  @IsEnum(TipoTransacaoCliente)
  tipo!: TipoTransacaoCliente;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  fee?: string;

  @Field(() => Float)
  @IsNumber()
  valor!: number;

  @Field(() => Float, { nullable: true })
  @IsNumber()
  @IsOptional()
  valorAplicado?: number;

  @Field(() => Int)
  @IsInt()
  clienteId!: number;

  @Field(() => Int)
  @IsInt()
  usuarioId!: number;

  @Field(() => Date)
  @IsDate()
  dataTransacao!: Date;
}
