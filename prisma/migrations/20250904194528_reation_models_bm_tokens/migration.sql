/*
  Warnings:

  - Added the required column `tokenId` to the `BM` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BM" ADD COLUMN     "tokenId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "BM" ADD CONSTRAINT "BM_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
