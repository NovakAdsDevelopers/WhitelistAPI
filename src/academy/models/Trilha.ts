import { ObjectType, Field, Int } from "type-graphql";
import { Modulo } from "./Modulo";
import { PaginationInfo } from "../../graphql/models/Utils";

@ObjectType()
export class Trilha {
  @Field((type) => Int)
  id!: number;

  @Field()
  nome!: string;

  @Field()
  descricao!: string;

  @Field()
  created_at!: Date;


  @Field((type) => [Modulo], { nullable: true })
  modulos!: Modulo[];
}

@ObjectType()
export class TrilhaResult {
  @Field(() => [Trilha])
  result!: Trilha[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}
