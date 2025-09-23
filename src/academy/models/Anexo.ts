
import { ObjectType, Field, Int } from "type-graphql";
import { PaginationInfo } from "../../graphql/models/Utils";

@ObjectType()
export class Anexo {
  @Field((type) => Int)
  id!: number;

  @Field()
  title!: string;

  @Field()
  downloadUrl!: string;

  @Field()
  created_at!: Date;

}

@ObjectType()
export class AnexoResult {
  @Field(() => [Anexo])
  result!: Anexo[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}
