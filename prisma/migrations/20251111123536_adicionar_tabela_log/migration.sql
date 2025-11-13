-- CreateTable
CREATE TABLE "Log" (
    "id" SERIAL NOT NULL,
    "origem" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "pilha" TEXT,
    "severidade" TEXT NOT NULL DEFAULT 'erro',
    "contexto" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);
