import { ObjectType, Field, Float, ID } from "type-graphql";
import { PaginationInfo } from "./Utils";

@ObjectType()
export class MetaPix {
  @Field(() => ID)
  id!: string;

  @Field()
  accountId!: string;

  @Field()
  accountName!: string;

  @Field()
  bmId!: string;

  @Field()
  bmNome!: string;

  @Field()
  usuarioId!: string;

  @Field()
  usuarioNome!: string;

  @Field(() => Float)
  valor!: number;

  @Field()
  codigoCopiaCola!: string;

  @Field()
  imageUrl!: string;

  // --- Campos opcionais ---
  @Field({ nullable: true })
  tipoRetorno?: string;

  @Field({ nullable: true })
  codigoSolicitacao?: string;

  @Field({ nullable: true })
  dataPagamento?: Date;

  @Field({ nullable: true })
  dataOperacao?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class MetaPixResult {
  @Field(() => [MetaPix])
  result!: MetaPix[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}
