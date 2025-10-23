import { MiddlewareFn } from "type-graphql";
import type { MyContext } from "../context/buildContext";

export const AuthMiddleware: MiddlewareFn<MyContext> = async ({ context }, next) => {
  if (!context.user) {
    throw new Error("Não autorizado. Faça login novamente.");
  }
  return next();
};
