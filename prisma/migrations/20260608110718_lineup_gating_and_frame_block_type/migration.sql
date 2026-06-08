-- AlterTable
ALTER TABLE "match_frames" ADD COLUMN     "awayPlayerId" TEXT,
ADD COLUMN     "blockType" "GameBlockType",
ADD COLUMN     "homePlayerId" TEXT;

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "awayLineupSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "awayLineupSubmittedById" TEXT,
ADD COLUMN     "homeLineupSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "homeLineupSubmittedById" TEXT;

-- AddForeignKey
ALTER TABLE "match_frames" ADD CONSTRAINT "match_frames_homePlayerId_fkey" FOREIGN KEY ("homePlayerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_frames" ADD CONSTRAINT "match_frames_awayPlayerId_fkey" FOREIGN KEY ("awayPlayerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
