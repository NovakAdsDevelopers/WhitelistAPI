import { ObjectType, Field, Int, Float } from "type-graphql";
import { ContasAnuncio } from "./conta-anuncio"; // Importe o tipo de AdAccount se necessário
import { PaginationInfo } from "./Utils";
import { Decimal } from "@prisma/client/runtime/library";

@ObjectType()
export class ClienteContaAnuncio {
  @Field((type) => Int)
  id!: number;

  @Field((type) => Int)
  clienteId!: number;

  @Field()
  contaAnuncioId!: string;

  @Field()
  inicioAssociacao!: Date;

  @Field({ nullable: true })
  fimAssociacao!: Date;

  @Field()
  ativo!: boolean;

  @Field((type) => Float) // Ajustado para Float
  saldo!: number; // Ajustado para number

  @Field((type) => Float) // Ajustado para Float
  depositoTotal!: number; // Ajustado para number

  @Field((type) => Float) // Ajustado para Float
  gastoTotal!: number;

  @Field()
  historico!: boolean;

  @Field((type) => ContasAnuncio)
  contaAnuncio!: ContasAnuncio;
}
@ObjectType()
export class ClienteContaAnuncioResult {
  @Field(() => [ClienteContaAnuncio])
  result!: ClienteContaAnuncio[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}

@ObjectType()
export class SetClienteContaAnuncioResponse {
  @Field(() => [ClienteContaAnuncio])
  associacoes!: ClienteContaAnuncio[];
}

@ObjectType()
export class PutClienteContaAnuncioResponse {
  @Field((type) => Int)
  id!: number;
}

@ObjectType()
export class SetTransacaoClienteContaAnuncioResponse {
  @Field((type) => Int)
  id!: number;

  @Field((type) => Int)
  clienteId!: number;
}
