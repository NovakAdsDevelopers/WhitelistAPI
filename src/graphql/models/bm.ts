import { Field, Int, ObjectType } from "type-graphql";
import { ContasAnuncio } from "./conta-anuncio";

@ObjectType()
export class BMs {
  @Field(() => Int)
  id!: number;

  @Field()
  nome!: string;

  @Field()
  BMId!: string;

  @Field(() => Int)
  tokenId!: number;

  // contador de contas de anúncio
  @Field(() => Int)
  adaccounts!: number;

  // se quiser também expor as contas
  @Field(() => [ContasAnuncio])
  contasAnuncio!: ContasAnuncio[];
}