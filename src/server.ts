import * as dotenv from 'dotenv';
dotenv.config();

import express, { Application } from 'express';
import { ApolloServer } from 'apollo-server-express';
import { createSchema } from './schema';
import { prisma } from './database';
import cors from 'cors';
import { metaSync } from './script'; // Importa o metaSync

const app: Application = express();

app.use(cors({
  origin: '*',
  credentials: true
}));

const startServer = async () => {
  try {
    try {
      await prisma.$connect();
      console.log('Conexão com o banco de dados estabelecida com sucesso.');
    } catch (dbError) {
      console.error('Erro ao tentar estabelecer conexão com o banco de dados:', dbError);
      process.exit(1);
    }

    const schema = await createSchema();
    const server = new ApolloServer({
      schema,
      persistedQueries: false,
      cache: 'bounded',
    });

    await server.start();

    server.applyMiddleware({ app });

    const port = process.env.PORT || 4000;

    // Iniciar o servidor Express principal
    app.listen(port, () => {
      console.log(`Servidor pronto em http://localhost:${port}${server.graphqlPath}`);
    });

    // Iniciar o servidor MetaSync na mesma porta ou outra se necessário
    const metaPort = process.env.META_SYNC_PORT || 5000;
    metaSync.listen(metaPort, () => {
      console.log(`MetaSync rodando na porta ${metaPort}`);
    });

  } catch (error) {
    console.error('Erro ao tentar iniciar o servidor:', error);
    process.exit(1);
  }
};

startServer();
