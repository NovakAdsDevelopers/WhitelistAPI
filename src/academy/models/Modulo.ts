import { ObjectType, Field, Int } from "type-graphql";
import { Secao } from "./Secao";
import { PaginationInfo } from "../../graphql/models/Utils";

@ObjectType()
export class Modulo {
  @Field((type) => Int)
  id!: number;

  @Field()
  nome!: string;

  @Field()
  descricao!: string;

  @Field()
  created_at!: Date;

  @Field((type) => Int)
  totalDurationSeconds!: number;

  @Field((type) => [Secao], { nullable: true })
  secoes!: Secao[];
}

@ObjectType()
export class ModuloResult {
  @Field(() => [Modulo])
  result!: Modulo[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}
