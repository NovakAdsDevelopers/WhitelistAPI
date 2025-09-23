/*
  Warnings:

  - You are about to drop the column `value` on the `Token` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[client_id]` on the table `Token` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[secret_id]` on the table `Token` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[last_token]` on the table `Token` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[token]` on the table `Token` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `client_id` to the `Token` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_token` to the `Token` table without a default value. This is not possible if the table is not empty.
  - Added the required column `secret_id` to the `Token` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token` to the `Token` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Token" DROP COLUMN "value",
ADD COLUMN     "client_id" TEXT NOT NULL,
ADD COLUMN     "last_token" TEXT NOT NULL,
ADD COLUMN     "secret_id" TEXT NOT NULL,
ADD COLUMN     "token" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Token_client_id_key" ON "Token"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "Token_secret_id_key" ON "Token"("secret_id");

-- CreateIndex
CREATE UNIQUE INDEX "Token_last_token_key" ON "Token"("last_token");

-- CreateIndex
CREATE UNIQUE INDEX "Token_token_key" ON "Token"("token");
