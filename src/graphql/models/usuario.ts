import { ObjectType, Field, Int, registerEnumType } from "type-graphql";
import { ContasAnuncio } from "./conta-anuncio";
import { ContasAnuncioInput } from "../inputs/conta-anuncio";
import { PaginationInfo } from "./Utils";

// Enum TypeGraphQL
export enum TipoUsuario {
  ADMIN = "ADMIN",
  GERENTE = "GERENTE",
  USUARIO = "USUARIO",
}

registerEnumType(TipoUsuario, {
  name: "TipoUsuario",
});

@ObjectType()
export class Usuario {
  @Field(() => Int)
  id!: number;

  @Field()
  nome!: string;

  @Field()
  email!: string;

  @Field(() => TipoUsuario)
  tipo!: TipoUsuario;

  @Field()
  criadoEm!: Date;

  @Field()
  atualizadoEm!: Date;

}

@ObjectType()
export class UsuarioResult {
  @Field(() => [Usuario])
  result!: Usuario[];

  @Field(() => PaginationInfo)
  pageInfo!: PaginationInfo;
}

@ObjectType()
export class LoginResponse {
  @Field()
  token!: string;
}