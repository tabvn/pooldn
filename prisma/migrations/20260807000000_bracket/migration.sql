-- Round-67 — single-elimination bracket linkage on matches.
ALTER TABLE "matches" ADD COLUMN     "bracketRound" INTEGER,
ADD COLUMN     "bracketPosition" INTEGER,
ADD COLUMN     "nextMatchId" TEXT,
ADD COLUMN     "nextMatchSlot" TEXT;

CREATE INDEX "matches_nextMatchId_idx" ON "matches"("nextMatchId");

ALTER TABLE "matches" ADD CONSTRAINT "matches_nextMatchId_fkey" FOREIGN KEY ("nextMatchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
