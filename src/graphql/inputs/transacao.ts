import { InputType, Field, Int, Float } from "type-graphql";
import { IsEnum, IsNumber, IsOptional, IsString, IsInt } from "class-validator";
import { TipoTransacao } from "@prisma/client";

@InputType()
export class TransacaoInput {
  @Field(() => String)
  @IsEnum(TipoTransacao)
  tipo!: TipoTransacao;

  @Field(() => Float)
  @IsNumber()
  valor!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  descricao?: string;

  @Field(() => Int)
  @IsInt()
  clienteId!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  contaOrigemId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  contaDestinoId?: string;

  @Field(() => Int)
  @IsInt()
  usuarioId!: number;
}
