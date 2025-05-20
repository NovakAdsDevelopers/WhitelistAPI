import { ObjectType, Field, Int } from "type-graphql";
import { ClienteContaAnuncio } from "./cliente-conta-anuncio";
import { PaginationInfo } from "./Utils";

@ObjectType()
export class Cliente {
  @Field((type) => Int)
  id!: number;

  @Field()
  nome!: string;

  @Field()
  email!: string;

  @Field()
  fee!: string;

  @Field()
  saldo!: number;

  @Field()
  depositoTotal!: number;

  @Field()
  gastoTotal!: number;

  @Field()
  alocacao!: number;

  @Field()
  saldoCliente!: number;

  @Field()
  cnpj!: string;

  @Field()
  criadoEm!: Date;

  @Field()
  atualizadoEm!: Date;

  @Field((type) => [ClienteContaAnuncio], { nullable: true })
  contasAnuncio!: ClienteContaAnuncio[];
}

@ObjectType()
export class ClienteResult {
  @Field(() => [Cliente])
  result!: Cliente[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}
