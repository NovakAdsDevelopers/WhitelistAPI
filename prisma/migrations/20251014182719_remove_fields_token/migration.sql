/*
  Warnings:

  - You are about to drop the column `cor` on the `Token` table. All the data in the column will be lost.
  - You are about to drop the column `img` on the `Token` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Token" DROP COLUMN "cor",
DROP COLUMN "img";
