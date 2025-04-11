-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('ADMIN', 'GERENTE', 'USUARIO');

-- CreateEnum
CREATE TYPE "TipoTransacao" AS ENUM ('ENTRADA', 'ENTRADA_ALOCADA', 'REALOCACAO', 'SAIDA_ALOCADA', 'SAIDA');

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

    CONSTRAINT "ClienteContaAnuncio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transacao" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoTransacao" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "dataTransacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT,
    "clienteId" INTEGER NOT NULL,
    "contaOrigemId" TEXT,
    "contaDestinoId" TEXT,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "Transacao_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Transacao_clienteId_dataTransacao_idx" ON "Transacao"("clienteId", "dataTransacao");

-- CreateIndex
CREATE INDEX "GastoDiario_contaAnuncioId_data_idx" ON "GastoDiario"("contaAnuncioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "GastoDiario_contaAnuncioId_data_key" ON "GastoDiario"("contaAnuncioId", "data");

-- AddForeignKey
ALTER TABLE "ClienteContaAnuncio" ADD CONSTRAINT "ClienteContaAnuncio_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteContaAnuncio" ADD CONSTRAINT "ClienteContaAnuncio_contaAnuncioId_fkey" FOREIGN KEY ("contaAnuncioId") REFERENCES "AdAccount"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transacao" ADD CONSTRAINT "Transacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transacao" ADD CONSTRAINT "Transacao_contaOrigemId_fkey" FOREIGN KEY ("contaOrigemId") REFERENCES "AdAccount"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transacao" ADD CONSTRAINT "Transacao_contaDestinoId_fkey" FOREIGN KEY ("contaDestinoId") REFERENCES "AdAccount"("account_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transacao" ADD CONSTRAINT "Transacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoDiario" ADD CONSTRAINT "GastoDiario_contaAnuncioId_fkey" FOREIGN KEY ("contaAnuncioId") REFERENCES "AdAccount"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;
