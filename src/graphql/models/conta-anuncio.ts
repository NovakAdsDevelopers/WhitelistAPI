
import { ObjectType, Field} from "type-graphql";
import { PaginationInfo } from "./Utils";
import { Decimal } from "@prisma/client/runtime/library";
import { BMs } from "./bm";

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
  gastoDiario!: string; 

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

   // --- Associação com BM ---
  @Field({ nullable: true })
  BMId?: string;

  @Field(() => BMs, { nullable: true })
  BM?: BMs; // ✅ agora o campo BM está tipado corretamente como objeto
}


@ObjectType()
export class ContasAnuncioResult {
  @Field(() => [ContasAnuncio])
  result!: ContasAnuncio[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}




@ObjectType()
export class ContasAnuncioGasto {
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

  // único campo de gasto
  @Field()
  gastoDiario!: string;

  // demais campos não são "gastos" e foram mantidos
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

  @Field()
  BMId!: string;
}

@ObjectType()
export class ContasAnuncioGastoResult {
  @Field(() => [ContasAnuncioGasto])
  result!: ContasAnuncioGasto[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}
