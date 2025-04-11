import { InputType, Field } from "type-graphql";
import { IsEmail, Length } from "class-validator";

@InputType()
export class ClienteCreateInput {
  @Field()
  @Length(3, 100)
  nome!: string;

  @Field()
  @IsEmail()
  email!: string;
}

@InputType()
export class ClienteUpdateInput {
  @Field({ nullable: true })
  @Length(3, 100)
  nome?: string;

  @Field({ nullable: true })
  @IsEmail()
  email?: string;
}