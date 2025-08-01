import { buildSchema } from "type-graphql";
import {
  ContasAnuncio,
  Cliente,
  ClienteContaAnuncio,
  ClienteTransacao,
  ContaLimite,
  ContaTransacao,
  Insights,
  GastoDiario,
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
      Insights,
      GastoDiario,
      Usuario
    ],
  });
};
