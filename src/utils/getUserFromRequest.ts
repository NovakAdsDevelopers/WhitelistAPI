// src/utils/getUserFromRequest.ts
import jwt from "jsonwebtoken";
import type { Request } from "express";
import type { PrismaClient } from "@prisma/client";

export async function getUserFromRequest(
  req: Request,
  prisma: PrismaClient,
  SECRET_KEY: string
) {
  const token = req.cookies?.jwt;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { id: number };
    if (!decoded?.id) return null;

    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { id: true, nome: true, email: true, tipo: true },
    });

    return user || null;
  } catch {
    return null;
  }
}
