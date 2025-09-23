import { InputType, Field, Int } from "type-graphql";

@InputType()
export class ModuloInput {
  @Field()
  nome!: string;

  @Field({ nullable: true })
  descricao?: string;

  @Field(() => Int)
  trilhaId!: number;
}

@InputType()
export class UpdateModuloInput {
  @Field({ nullable: true })
  nome?: string;

  @Field({ nullable: true })
  descricao?: string;

  @Field(() => Int, { nullable: true })
  trilhaId?: number;
}
