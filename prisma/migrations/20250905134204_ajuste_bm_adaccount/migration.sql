/*
  Warnings:

  - You are about to drop the column `BM` on the `AdAccount` table. All the data in the column will be lost.
  - You are about to drop the column `bm_id` on the `BM` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[BMId]` on the table `BM` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `BMId` to the `BM` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "BM_bm_id_key";

-- AlterTable
ALTER TABLE "AdAccount" DROP COLUMN "BM",
ADD COLUMN     "BMId" INTEGER;

-- AlterTable
ALTER TABLE "BM" DROP COLUMN "bm_id",
ADD COLUMN     "BMId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BM_BMId_key" ON "BM"("BMId");

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_BMId_fkey" FOREIGN KEY ("BMId") REFERENCES "BM"("BMId") ON DELETE SET NULL ON UPDATE CASCADE;
