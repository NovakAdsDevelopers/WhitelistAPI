import { InputType, Field, Int } from "type-graphql";

@InputType()
export class SecaoInput {
  @Field()
  nome!: string;

  @Field({ nullable: true })
  descricao?: string;

  @Field(() => Int)
  moduloId!: number;
}

@InputType()
export class UpdateSecaoInput {
  @Field({ nullable: true })
  nome?: string;

  @Field({ nullable: true })
  descricao?: string;

  @Field(() => Int, { nullable: true })
  moduloId?: number;
}
