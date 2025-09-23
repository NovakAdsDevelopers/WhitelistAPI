
import { ObjectType, Field, Int } from "type-graphql";
import { Anexo } from "./Anexo";
import { PaginationInfo } from "../../graphql/models/Utils";

@ObjectType()
export class Aula {
  @Field((type) => Int)
  id!: number;

  @Field()
  nome!: string;

  @Field()
  descricao!: string;

  @Field()
  created_at!: Date;

  @Field((type) => [Anexo], { nullable: true })
  anexos!: Anexo[];

}

@ObjectType()
export class AulaResult {
  @Field(() => [Aula])
  result!: Aula[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}
