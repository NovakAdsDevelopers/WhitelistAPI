import "reflect-metadata";
import { ObjectType, Field} from "type-graphql";
import { PaginationInfo } from "./Utils";

@ObjectType()
export class ContasAnuncio {
  @Field()
  id!: string; 

  @Field()
  nome!: string;

  @Field()
  status!: number;

  @Field()
  moeda!: string;

  @Field()
  fusoHorario!: string; 

  @Field()
  gastoTotal!: string; 

  @Field()
  gastoAPI!: string; 
}


@ObjectType()
export class ContasAnuncioResult {
  @Field(() => [ContasAnuncio])
  result!: ContasAnuncio[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}
