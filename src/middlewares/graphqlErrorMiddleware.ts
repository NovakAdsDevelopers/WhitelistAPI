// src/middlewares/graphqlErrorMiddleware.ts
import { MiddlewareFn } from "type-graphql";
import { PrismaClient } from "@prisma/client";
import axios from "axios";

const prisma = new PrismaClient();

const SLACK_WEBHOOK_URL_LOGS = process.env.SLACK_WEBHOOK_URL_LOGS;

export const GraphQLErrorLogger: MiddlewareFn<any> = async ({ context, info }, next) => {
  try {
    return await next();
  } catch (error: any) {
    // Cria o log no banco
    const log = await prisma.log.create({
      data: {
        origem: "graphql",
        tipo: "erro",
        mensagem: error.message || "Erro desconhecido",
        pilha: error.stack || null,
        contexto: {
          operation: info.parentType.name,
          field: info.fieldName,
          path: info.path.key,
          user: context?.user?.id || null,
        },
      },
    });

    // Envia alerta ao Slack
    if (SLACK_WEBHOOK_URL_LOGS) {
      try {
        await axios.post(SLACK_WEBHOOK_URL_LOGS, {
          text: `🚨 *Erro nas requisições do Painel!*
*Mensagem:* ${error.message}
*Campo:* ${info.parentType.name}.${info.fieldName}
*Log ID:* ${log.id}`,
        });
      } catch (slackError) {
        console.error("❌ Falha ao enviar alerta para o Slack:", slackError);
      }
    }

    throw error;
  }
};
