-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('ADMIN', 'GERENTE', 'USUARIO');

-- CreateEnum
CREATE TYPE "TipoTransacaoCliente" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "TipoTransacaoConta" AS ENUM ('ENTRADA', 'SAIDA', 'REALOCACAO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "tipo" "TipoUsuario" NOT NULL DEFAULT 'USUARIO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "saldo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "depositoTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gastoTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cnpj" TEXT NOT NULL,
    "fee" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_status" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "timezone_name" TEXT NOT NULL,
    "amount_spent" TEXT NOT NULL,
    "depositoTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gastoTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "ClienteContaAnuncio" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "contaAnuncioId" TEXT NOT NULL,
    "inicioAssociacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fimAssociacao" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "historico" BOOLEAN NOT NULL DEFAULT false,
    "gastoTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "depositoTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ClienteContaAnuncio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransacaoCliente" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoTransacaoCliente" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "dataTransacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fee" TEXT,
    "valorAplicado" DECIMAL(10,2),
    "clienteId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransacaoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransacaoConta" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoTransacaoConta" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "dataTransacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT,
    "contaOrigemId" TEXT,
    "contaDestinoId" TEXT,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "TransacaoConta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoDiario" (
    "id" SERIAL NOT NULL,
    "contaAnuncioId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "gasto" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "GastoDiario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_email_key" ON "Cliente"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClienteContaAnuncio_clienteId_contaAnuncioId_inicioAssociac_key" ON "ClienteContaAnuncio"("clienteId", "contaAnuncioId", "inicioAssociacao");

-- CreateIndex
CREATE INDEX "TransacaoCliente_clienteId_dataTransacao_idx" ON "TransacaoCliente"("clienteId", "dataTransacao");

-- CreateIndex
CREATE INDEX "TransacaoConta_dataTransacao_idx" ON "TransacaoConta"("dataTransacao");

-- CreateIndex
CREATE INDEX "GastoDiario_contaAnuncioId_data_idx" ON "GastoDiario"("contaAnuncioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "GastoDiario_contaAnuncioId_data_key" ON "GastoDiario"("contaAnuncioId", "data");

-- AddForeignKey
ALTER TABLE "ClienteContaAnuncio" ADD CONSTRAINT "ClienteContaAnuncio_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteContaAnuncio" ADD CONSTRAINT "ClienteContaAnuncio_contaAnuncioId_fkey" FOREIGN KEY ("contaAnuncioId") REFERENCES "AdAccount"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoCliente" ADD CONSTRAINT "TransacaoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoCliente" ADD CONSTRAINT "TransacaoCliente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoConta" ADD CONSTRAINT "TransacaoConta_contaDestinoId_fkey" FOREIGN KEY ("contaDestinoId") REFERENCES "AdAccount"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoConta" ADD CONSTRAINT "TransacaoConta_contaOrigemId_fkey" FOREIGN KEY ("contaOrigemId") REFERENCES "AdAccount"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoConta" ADD CONSTRAINT "TransacaoConta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoDiario" ADD CONSTRAINT "GastoDiario_contaAnuncioId_fkey" FOREIGN KEY ("contaAnuncioId") REFERENCES "AdAccount"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;
