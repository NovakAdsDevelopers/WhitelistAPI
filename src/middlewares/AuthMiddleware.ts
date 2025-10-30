import { MiddlewareFn } from "type-graphql";
import type { MyContext } from "../context/buildContext";
import { AuthenticationError } from "apollo-server-core";

export const AuthMiddleware: MiddlewareFn<MyContext> = async ({ context }, next) => {
  if (!context.user) {
    throw new AuthenticationError("Sessão expirada. Faça login novamente.", {
      code: "TOKEN_EXPIRED",
    });
  }
  return next();
};
