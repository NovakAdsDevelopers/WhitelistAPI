import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import crypto from "node:crypto";

export type UserCtx = {
  id: number;
  nome: string;
  email: string;
  tipo: "ADMIN" | "GERENTE" | "USUARIO";
};

export type MyContext = {
  user?: UserCtx;
  requestId: string;
  req: Request;
  res: Response;
};

type JwtPayload = { id: number; iat?: number; exp?: number };

export function buildContextFactory(prisma: PrismaClient, SECRET_KEY: string) {
  return async ({ req, res }: { req: Request; res: Response }) => {
    const requestId = crypto.randomUUID();
    const token = req.cookies?.jwt;

    if (!token) {
      console.log("👤 [CTX] Requisição sem token — anônima");
      return { req, res, requestId };
    }

    try {
      const decoded = jwt.verify(token, SECRET_KEY) as JwtPayload;

      if (!decoded?.id) {
        console.warn("⚠️ [CTX] Token sem ID válido");
        return { req, res, requestId };
      }

      const user = await prisma.usuario.findUnique({
        where: { id: decoded.id },
        select: { id: true, nome: true, email: true, tipo: true },
      });

      if (!user) {
        console.warn("⚠️ [CTX] Usuário não encontrado para ID", decoded.id);
        return { req, res, requestId };
      }

      return {
        req,
        res,
        requestId,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          tipo: user.tipo as UserCtx["tipo"],
        },
      };
    } catch (err: any) {
      const message = err.message ?? "";
      if (message.includes("jwt expired")) {
        console.warn("⚠️ [CTX] JWT expirado — contexto anônimo");
      } else if (message.includes("invalid token")) {
        console.warn("⚠️ [CTX] JWT inválido — contexto anônimo");
      } else {
        console.warn("⚠️ [CTX] Erro inesperado:", message);
      }
      return { req, res, requestId };
    }
  };
}
