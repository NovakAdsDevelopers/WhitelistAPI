import { IsOptional, IsString, Length, Matches, IsUrl, IsDate } from "class-validator";
import { Field, InputType } from "type-graphql";

@InputType()
export class IntegracaoCreateInput {
  @Field()
  @Length(3, 100, { message: "O título deve ter entre 3 e 100 caracteres" })
  title!: string;

  @Field()
  @IsString({ message: "client_id deve ser uma string" })
  client_id!: string;

  @Field()
  @IsString({ message: "secret_id deve ser uma string" })
  secret_id!: string;

  @Field()
  @IsString({ message: "last_token deve ser uma string" })
  last_token!: string;
  
  @Field({ nullable: true })
  @IsOptional()
  @IsDate({ message: "spend_date deve ser uma data válida" })
  spend_date?: Date;
}
