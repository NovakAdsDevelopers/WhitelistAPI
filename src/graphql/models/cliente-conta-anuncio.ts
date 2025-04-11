import { ObjectType, Field, Int } from "type-graphql";
import { ContasAnuncio } from "./conta-anuncio"; // Importe o tipo de AdAccount se necessário
import { PaginationInfo } from "./Utils";

@ObjectType()
export class ClienteContaAnuncio {
  @Field(type => Int)
  id!: number;

  @Field(type => Int)
  clienteId!: number;

  @Field()
  contaAnuncioId!: string;

  @Field()
  inicioAssociacao!: Date;

  @Field({ nullable: true })
  fimAssociacao!: Date;

  @Field()
  ativo!: Boolean;

  @Field()
  historico!: Boolean;

  @Field(type => ContasAnuncio)
  contaAnuncio!: ContasAnuncio;
}

@ObjectType()
export class SetClienteContaAnuncioResponse {
  @Field(() => [ClienteContaAnuncio])
  associacoes!: ClienteContaAnuncio[];
}

@ObjectType()
export class ClienteContaAnuncioResult {
  @Field(() => [ClienteContaAnuncio])
  result!: ClienteContaAnuncio[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}