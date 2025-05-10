
import "reflect-metadata";
import { ObjectType, Field} from "type-graphql";
import { PaginationInfo } from "./Utils";
import { Decimal } from "@prisma/client/runtime/library";

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

  @Field()
  limiteGasto!: string; 

  @Field()
  saldoMeta!: string; 

  @Field()
  saldo!: number; 

  @Field()
  depositoTotal!: number; 

  @Field()
  ultimaSincronizacao!: string; 
}


@ObjectType()
export class ContasAnuncioResult {
  @Field(() => [ContasAnuncio])
  result!: ContasAnuncio[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}
