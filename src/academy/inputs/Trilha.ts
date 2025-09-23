import { InputType, Field } from "type-graphql";

@InputType()
export class TrilhaInput {
  @Field()
  nome!: string;

  @Field({ nullable: true })
  descricao?: string;
}

@InputType()
export class UpdateTrilhaInput {
  @Field({ nullable: true })
  nome?: string;

  @Field({ nullable: true })
  descricao?: string;
}
