// src/context/buildContext.ts
import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import crypto from "node:crypto";

// ================================
// Tipos do contexto
// ================================
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

// ================================
// Factory do contexto do Apollo
// ================================
export function buildContextFactory(
  prisma: PrismaClient,
  SECRET_KEY: string
): (args: { req: Request; res: Response }) => Promise<MyContext> {
  return async function buildContext({
    req,
    res,
  }: {
    req: Request;
    res: Response;
  }): Promise<MyContext> {
    const requestId = crypto.randomUUID();
    const token = req.cookies?.jwt;

    // requisição anônima (sem cookie)
    if (!token) {
      return { req, res, requestId };
    }

    try {
      const decoded = jwt.verify(token, SECRET_KEY) as JwtPayload;

      const user = await prisma.usuario.findUnique({
        where: { id: decoded.id },
        select: { id: true, nome: true, email: true, tipo: true },
      });

      if (!user) return { req, res, requestId };

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
    } catch (err: unknown) {
      const message = (err as Error)?.message || "Erro ao validar JWT";

      // ⚠️ Aqui NÃO lançamos erro, apenas registramos
      if (message.includes("jwt expired") || message.includes("TokenExpiredError")) {
        console.warn("⚠️ JWT expirado no buildContext (ignorado para login)");
        return { req, res, requestId };
      }

      if (message.includes("invalid token") || message.includes("JsonWebTokenError")) {
        console.warn("⚠️ JWT inválido no buildContext (ignorado)");
        return { req, res, requestId };
      }

      console.warn("⚠️ Erro inesperado no buildContext:", message);
      return { req, res, requestId };
    }
  };
}
