import { ObjectType, Field, Int } from "type-graphql";
import { PaginationInfo } from "../../graphql/models/Utils";

@ObjectType()
export class Atividade {
  @Field((type) => Int)
  id!: number;

  @Field()
  titulo!: string;

  @Field()
  descricao!: string;

  @Field()
  quiz!: JSON;

  @Field()
  created_at!: Date;

}

@ObjectType()
export class AtividadeResult {
  @Field(() => [Atividade])
  result!: Atividade[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}

