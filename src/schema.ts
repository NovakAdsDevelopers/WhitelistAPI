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
  TestError
} from "./graphql/resolvers";
import { GraphQLErrorLogger } from "./middlewares/graphqlErrorMiddleware";

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
      TestError
    ],
    globalMiddlewares: [GraphQLErrorLogger],
  });
};
