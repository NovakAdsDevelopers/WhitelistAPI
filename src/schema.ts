import "reflect-metadata";
import { buildSchema } from "type-graphql";
import {
  BMS,
  ContasAnuncio,
  Cliente,
  ClienteContaAnuncio,
  ClienteTransacao,
  ContaLimite,
  ContaTransacao,
  Insights,
  Integracao,
  GastoDiario,
  Usuario,
} from "./graphql/resolvers";

export const createSchema = async () => {
  return buildSchema({
    resolvers: [
      BMS,
      Cliente,
      ClienteContaAnuncio,
      ContasAnuncio,
      ClienteTransacao,
      ContaLimite,
      ContaTransacao,
      Insights,
      Integracao,
      GastoDiario,
      Usuario,
    ],
  });
};
