import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers["x-request-id"] as string) || randomUUID();
  // @ts-ignore
  req.id = incoming;
  res.setHeader("x-request-id", incoming);
  next();
}