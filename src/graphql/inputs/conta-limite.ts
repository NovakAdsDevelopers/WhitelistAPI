import { InputType, Field } from "type-graphql";
import { IsBoolean, IsEmail, IsNumber, IsString, Length } from "class-validator";

@InputType()
export class ContaLimiteAjusteInput {
  @Field()
  @IsString()
  contaAnuncioID!: string;

  @Field()
  @IsString()
  limiteCritico!: string;

  @Field()
  @IsString()
  limiteMedio!: string;

  @Field()
  @IsString()
  limiteInicial!: string;

  @Field()
  @IsBoolean()
  alertaAtivo!: boolean;
}
