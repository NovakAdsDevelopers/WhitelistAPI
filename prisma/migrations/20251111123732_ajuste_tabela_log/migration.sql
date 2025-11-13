/*
  Warnings:

  - You are about to drop the column `severidade` on the `Log` table. All the data in the column will be lost.
  - Added the required column `tipo` to the `Log` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Log" DROP COLUMN "severidade",
ADD COLUMN     "tipo" TEXT NOT NULL;
