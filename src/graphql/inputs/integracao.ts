import { IsOptional, IsString, Length, Matches, IsUrl } from "class-validator";
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

  @Field({ nullable: true, defaultValue: "#000000" })
  @IsOptional()
  @Matches(/^#([0-9A-Fa-f]{3}){1,2}$/, { message: "Cor deve ser um HEX válido" })
  cor?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl({}, { message: "URL da imagem inválida" })
  img?: string;
}
