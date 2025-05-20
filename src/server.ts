import * as dotenv from 'dotenv';
dotenv.config();

import express, { Application } from 'express';
import { ApolloServer } from 'apollo-server-express';
import { createSchema } from './schema';
import { prisma } from './database';
import cors from 'cors';
import { metaSync } from './script'; // Importa a aplicação do MetaSync

const app: Application = express();

// Configurações de CORS
app.use(
  cors({
    origin: '*', // Altere isso conforme necessário em produção
    credentials: true
  })
);

// Função para iniciar o servidor
const startServer = async () => {
  try {
    // Conectar ao banco de dados
    try {
      await prisma.$connect();
      console.log('Conexão com o banco de dados estabelecida com sucesso.');
    } catch (dbError) {
      console.error('Erro ao tentar estabelecer conexão com o banco de dados:', dbError);
      process.exit(1);
    }

    // Criar o esquema GraphQL
    const schema = await createSchema();
    const server = new ApolloServer({
      schema,
      persistedQueries: false,
      cache: 'bounded',
    });

    // Iniciar o servidor Apollo (GraphQL)
    await server.start();
    server.applyMiddleware({ app }); // Aplica o middleware Apollo no Express

    // Definir a porta (Render usará a variável PORT)
    const port = process.env.PORT || 4000;

    // Iniciar o servidor Express
    app.listen(port, () => {
      console.log(`Servidor GraphQL rodando em http://localhost:${port}${server.graphqlPath}`);
    });

    // Integrar o MetaSync à mesma instância do servidor Express, em uma rota própria
    app.use('/meta', metaSync);  // Agora o MetaSync estará acessível em /meta

    console.log('MetaSync rodando na rota /meta');
    
  } catch (error) {
    console.error('Erro ao tentar iniciar o servidor:', error);
    process.exit(1);
  }
};

// Iniciar o servidor
startServer();
