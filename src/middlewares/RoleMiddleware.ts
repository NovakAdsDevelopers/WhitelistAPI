import { MiddlewareFn } from "type-graphql";
import type { MyContext } from "../context/buildContext";

type Role = "ADMIN" | "GERENTE" | "USUARIO";

/**
 * Use nos resolvers:
 * @UseMiddleware(AuthMiddleware, RequireRole("ADMIN", "GERENTE"))
 */
export function RequireRole(...roles: Role[]): MiddlewareFn<MyContext> {
  return async ({ context }, next) => {
    const user = context.user;
    if (!user) throw new Error("Não autorizado.");

    if (!roles.includes(user.tipo)) {
      throw new Error("Acesso negado. Permissão insuficiente.");
    }

    return next();
  };
}
