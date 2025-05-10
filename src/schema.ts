import { buildSchema } from "type-graphql";
import {
  ContasAnuncio,
  Cliente,
  ClienteContaAnuncio,
  ClienteTransacao,
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
      ContaTransacao,
      Usuario
    ],
  });
};
