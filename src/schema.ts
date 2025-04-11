import { buildSchema } from "type-graphql";
import {
  ContasAnuncio,
  Cliente,
  ClienteContaAnuncio,
  Usuario,
  Transacao,
} from "./graphql/resolvers";

export const createSchema = async () => {
  return buildSchema({
    resolvers: [
      Cliente,
      ClienteContaAnuncio,
      ContasAnuncio,
      Transacao,
      Usuario,
    ],
  });
};
