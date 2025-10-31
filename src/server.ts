import * as dotenv from "dotenv";
dotenv.config();

import express, { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ApolloServer } from "apollo-server-express";
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from "apollo-server-core";
import { createSchema } from "./schema";
import { prisma } from "./database";
import { metaSync } from "./script";
import { buildContextFactory } from "./context/buildContext";

const app: Application = express();

// ====================================================================
// 🔄 Controle de sync
// ====================================================================
let syncRunning = false;
export const setSyncRunning = (state: boolean) => {
  syncRunning = state;
};

// ====================================================================
// 🍪 Middlewares básicos
// ====================================================================
app.use(cookieParser());
app.use(express.json());

// ====================================================================
// 🌍 Configuração dinâmica e segura de CORS
// ====================================================================
const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

// Se for produção, exige variável FRONTEND_URL, senão usa localhost
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  (isProd
    ? (() => {
        console.error("❌ FRONTEND_URL não definida em produção!");
        process.exit(1);
      })()
    : "http://localhost:5173");

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true, // ✅ necessário para cookies cross-site
  })
);

console.log(`🌐 Ambiente: ${NODE_ENV}`);
console.log(`🌍 FRONTEND_URL: ${FRONTEND_URL}`);

// ====================================================================
// 🚀 Função principal de inicialização
// ====================================================================
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Conexão com o banco de dados estabelecida com sucesso.");

    const schema = await createSchema();

    const SECRET_KEY = process.env.JWT_SECRET;
    if (!SECRET_KEY) {
      console.error("❌ JWT_SECRET ausente no .env");
      process.exit(1);
    }

    // ----------------------------------------------------------------
    // ⚙️ Apollo Server
    // ----------------------------------------------------------------
    const server = new ApolloServer({
      schema,
      persistedQueries: false,
      cache: "bounded",
      context: buildContextFactory(prisma, SECRET_KEY),
      introspection: !isProd, // introspection só em dev
      plugins: isProd
        ? [ApolloServerPluginLandingPageProductionDefault()]
        : [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
    });

    await server.start();

    server.applyMiddleware({
      app,
      path: "/graphql",
      cors: false, // ❗ já configuramos CORS acima
    });

    // ----------------------------------------------------------------
    // 🛰️ MetaSync
    // ----------------------------------------------------------------
    app.use("/meta", metaSync);
    console.log("🔗 MetaSync rodando na rota /meta");

    // ----------------------------------------------------------------
    // 🚀 Inicialização do servidor HTTP
    // ----------------------------------------------------------------
    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(`🚀 Servidor GraphQL rodando em: http://localhost:${port}/graphql`);
      console.log(`🌍 CORS liberado para: ${FRONTEND_URL}`);
      console.log(
        isProd
          ? "🔒 Modo produção (Apollo Sandbox desativado)"
          : "🧪 Apollo Sandbox habilitado (modo dev)"
      );
    });
  } catch (error) {
    console.error("❌ Erro ao iniciar o servidor:", error);
    process.exit(1);
  }
};

// ====================================================================
// 🔥 Start
// ====================================================================
startServer();
