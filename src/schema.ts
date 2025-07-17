import { buildSchema } from "type-graphql";
import {
  ContasAnuncio,
  Cliente,
  ClienteContaAnuncio,
  ClienteTransacao,
  ContaLimite,
  ContaTransacao,
  Usuario
} from "./graphql/resolvers";

export const createSchema = async () => {
  return buildSchema({
    resolvers: [
      Cliente,
      ClienteContaAnuncio,
      ContasAnuncio,
      ClienteTransacao,
      ContaLimite,
      ContaTransacao,
      Usuario
    ],
  });
};
