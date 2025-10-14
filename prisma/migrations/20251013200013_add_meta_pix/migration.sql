-- CreateTable
CREATE TABLE "MetaPix" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "bmId" TEXT NOT NULL,
    "bmNome" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNome" TEXT NOT NULL,
    "valor" DECIMAL(16,2) NOT NULL,
    "codigoCopiaCola" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "tipoRetorno" TEXT,
    "codigoSolicitacao" TEXT,
    "dataPagamento" TIMESTAMP(3),
    "dataOperacao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaPix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_metapix_account_created" ON "MetaPix"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "uq_metapix_codigo" ON "MetaPix"("codigoCopiaCola");

-- AddForeignKey
ALTER TABLE "MetaPix" ADD CONSTRAINT "MetaPix_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount"("account_id") ON DELETE RESTRICT ON UPDATE CASCADE;
