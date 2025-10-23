import { Field, Int, ObjectType } from "type-graphql";
import { PaginationInfo } from "./Utils";
import { BMs } from "./bm";

@ObjectType()
export class IntegracaoModel {
  @Field(() => String)
  token!: string;

  @Field(() => String)
  client_id!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  secret_id!: string;

  @Field(() => Number)
  id!: number;

  @Field(() => [BMs])
  bms!: BMs[];

  @Field(() => Int)               // total por integração (soma de todas as BMs)
  totalAdAccounts!: number;

  @Field(() => String)
  situacao!: string;
}

@ObjectType()
export class IntegracaoResult {
  @Field(() => [IntegracaoModel])
  result!: IntegracaoModel[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}
