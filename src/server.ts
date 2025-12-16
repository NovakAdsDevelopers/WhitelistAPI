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
import { expressErrorHandler } from "./middlewares/expressErrorLog";

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
// 🌍 Configuração de CORS com múltiplos domínios
// ====================================================================
const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

// Lê lista de URLs do .env
const envOrigins = process.env.FRONTEND_URLS
  ? process.env.FRONTEND_URLS.split(",").map((url) => url.trim())
  : [];

// Domínios permitidos
const allowedOrigins = isProd
  ? envOrigins // Produção → exige lista no .env
  : [
      "https://whitelist-rosy.vercel.app",
      ...envOrigins, // Também permite os domínios do .env em dev
    ];

console.log("🌐 Ambiente:", NODE_ENV);
console.log("🌍 Allowed Origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (ex: Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("❌ CORS bloqueou a origem:", origin);
      return callback(new Error("Origem não permitida pelo CORS"));
    },
    credentials: true,
  })
);

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
      introspection: !isProd,
      plugins: isProd
        ? [ApolloServerPluginLandingPageProductionDefault()]
        : [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
    });

    await server.start();

    server.applyMiddleware({
      app,
      path: "/graphql",
      cors: false, // ❗ CORS já está configurado acima
    });

    // ----------------------------------------------------------------
    // 🛰️ MetaSync
    // ----------------------------------------------------------------
    app.use("/meta", metaSync);
    console.log("🔗 MetaSync rodando na rota /meta");

    app.use(expressErrorHandler());

    // ----------------------------------------------------------------
    // 🚀 Inicialização do servidor HTTP
    // ----------------------------------------------------------------
    const port = process.env.PORT || 4000;
    app.listen(port, () => {
      console.log(
        `🚀 Servidor GraphQL rodando em: http://localhost:${port}/graphql`
      );
      console.log(`🌍 CORS liberado para:`, allowedOrigins);
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
