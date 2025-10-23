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

export function buildContextFactory(prisma: PrismaClient, SECRET_KEY: string) {
  return async function buildContext({
    req,
    res,
  }: {
    req: Request;
    res: Response;
  }): Promise<MyContext> {
    const requestId = crypto.randomUUID();
    const token = req.cookies?.jwt; // 🍪 token vem do cookie httpOnly

    if (!token) {
      return { req, res, requestId };
    }

    try {
      const decoded = jwt.verify(token, SECRET_KEY) as any;

      // opcional: revalida o usuário no banco
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
    } catch (err: any) {
      console.warn("⚠️ JWT inválido ou expirado:", err?.message || err);
      return { req, res, requestId };
    }
  };
}
