-- Round-64 — staff (competition organizer / SUPER_ADMIN) entered lineups or
-- frame results on behalf of the teams. Drives the "entered by organizer"
-- note on the match screen.

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "staffInputById" TEXT,
ADD COLUMN     "staffInputAt" TIMESTAMP(3),
ADD COLUMN     "staffEnteredLineup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "staffEnteredResult" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_staffInputById_fkey" FOREIGN KEY ("staffInputById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
