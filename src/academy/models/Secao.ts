import { ObjectType, Field, Int } from "type-graphql";
import { Aula } from "./Aula";
import { Atividade } from "./Atividade";
import { PaginationInfo } from "../../graphql/models/Utils";

@ObjectType()
export class Secao {
  @Field((type) => Int)
  id!: number;

  @Field()
  nome!: string;

  @Field()
  descricao!: string;

  @Field((type) => Int)
  totalDurationSeconds!: number;

  @Field()
  created_at!: Date;

  @Field((type) => [Aula], { nullable: true })
  aulas!: Aula[];

  @Field((type) => [Atividade], { nullable: true })
  atividades!: Atividade[];
}

@ObjectType()
export class SecaoResult {
  @Field(() => [Secao])
  result!: Secao[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}
