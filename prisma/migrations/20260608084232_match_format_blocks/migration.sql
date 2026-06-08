-- CreateEnum
CREATE TYPE "GameBlockType" AS ENUM ('SINGLES', 'DOUBLES', 'SCOTCH_DOUBLES');

-- AlterTable
ALTER TABLE "competitions" ADD COLUMN     "breakAndRunRule" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "match_format_blocks" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "GameBlockType" NOT NULL,
    "games" INTEGER NOT NULL DEFAULT 1,
    "raceTo" INTEGER,
    "breakAfterMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_format_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_format_blocks_competitionId_idx" ON "match_format_blocks"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "match_format_blocks_competitionId_order_key" ON "match_format_blocks"("competitionId", "order");

-- AddForeignKey
ALTER TABLE "match_format_blocks" ADD CONSTRAINT "match_format_blocks_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
