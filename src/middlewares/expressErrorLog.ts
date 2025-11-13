import { Request, Response, NextFunction } from "express";
import { prisma } from "../database";
import axios from "axios";

const SLACK_WEBHOOK_URL_LOGS = process.env.SLACK_WEBHOOK_URL_LOGS;

// Evita flood no Slack (1 alerta por mensagem a cada 30s)
const lastAlerts = new Map<string, number>();
const THROTTLE_MS = 30_000;

export function expressErrorHandler() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return async (
    err: any,
    req: Request & { id?: string; user?: any },
    res: Response,
    _next: NextFunction
  ) => {
    const status = err.statusCode || err.status || 500;

    const safeBody = sanitizeBody(req.body);

    const log = await prisma.log.create({
      data: {
        origem: "express",
        tipo: status >= 500 ? "critico" : "erro",
        mensagem: err?.message || "Erro desconhecido",
        pilha: err?.stack ?? null,
        contexto: {
          method: req.method,
          path: req.originalUrl || req.url,
          query: req.query,
          params: req.params,
          body: safeBody,
          ip: req.ip,
          user: req.user ?? null, // 👈 aqui é o ajuste
          headers: {
            "user-agent": req.headers["user-agent"],
            referer: req.headers["referer"],
          },
        },
        // requestId: req.id,
        // statusHttp: status,
        // operacao: `${req.method} ${req.path}`,
      },
    });

    if (SLACK_WEBHOOK_URL_LOGS && status >= 500) {
      const key = `${err?.message}:${req.method}:${req.path}`;
      const now = Date.now();
      const last = lastAlerts.get(key) || 0;

      if (now - last > THROTTLE_MS) {
        lastAlerts.set(key, now);
        try {
          await axios.post(SLACK_WEBHOOK_URL_LOGS, {
            text: `🧯 *Erro nas requisições do Meta: ${status}*
            *Rota:* ${req.method} ${req.originalUrl}
            *Msg:* ${err?.message}
            *User:* ${req.user ? `${req.user.id} - ${req.user.email}` : "anônimo"}
            *ReqID:* ${req.id || "-"}
            *Log ID:* ${log.id}`,
          });
        } catch (e) {
          console.error(
            "Falha ao enviar alerta ao Slack:",
            (e as Error).message
          );
        }
      }
    }

    res.status(status).json({
      error: status >= 500 ? "Internal error" : "Request error",
      requestId: req.id,
    });
  };
}

function sanitizeBody(body: any) {
  if (!body || typeof body !== "object") return body ?? null;
  const clone = { ...body };
  for (const k of Object.keys(clone)) {
    const key = k.toLowerCase();
    if (
      ["password", "senha", "token", "secret", "authorization"].includes(key)
    ) {
      clone[k] = "[REDACTED]";
    }
  }
  return clone;
}
