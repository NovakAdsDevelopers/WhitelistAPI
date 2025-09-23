import { InputType, Field, Int } from "type-graphql";
import GraphQLJSON from "graphql-type-json";

@InputType()
export class AtividadeInput {
  @Field(() => Int)
  secaoId!: number;

  @Field(() => GraphQLJSON)
  quiz!: any; // você pode tipar depois como interface se quiser

  @Field({ nullable: true })
  titulo?: string;

  @Field({ nullable: true })
  descricao?: string;
}

@InputType()
export class UpdateAtividadeInput {
  @Field(() => GraphQLJSON, { nullable: true })
  quiz?: any;

  @Field({ nullable: true })
  titulo?: string;

  @Field({ nullable: true })
  descricao?: string;

  @Field(() => Int, { nullable: true })
  secaoId?: number;
}
