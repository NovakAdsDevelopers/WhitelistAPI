-- CreateTable
CREATE TABLE "ExtratoTransacaoInter" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT,
    "fingerprint" TEXT,
    "dataEntrada" TIMESTAMP(3),
    "dataEfetivacao" TIMESTAMP(3),
    "valor" DECIMAL(65,30) NOT NULL,
    "descricao" TEXT,
    "tipoOperacao" TEXT,
    "tipoTransacao" TEXT,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtratoTransacaoInter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtratoTransacaoInter_externalId_key" ON "ExtratoTransacaoInter"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtratoTransacaoInter_fingerprint_key" ON "ExtratoTransacaoInter"("fingerprint");
