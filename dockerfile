# Usando a imagem base do Node.js
FROM node:18

# Definindo o diretório de trabalho
WORKDIR /usr/src/app

# Copiando os arquivos de configuração
COPY package*.json ./

# Instalando as dependências com Yarn
RUN yarn install

# Copiando o restante dos arquivos da API
COPY . .

# Compilando o TypeScript (se necessário)
RUN yarn build

# Expondo a porta da API
EXPOSE 3000

# Comando para iniciar a API
CMD ["yarn", "start"]
