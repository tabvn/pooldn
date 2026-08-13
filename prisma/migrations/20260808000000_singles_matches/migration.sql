-- Round-68 — INDIVIDUAL (Singles) matches are player-vs-player.
ALTER TABLE "matches" ADD COLUMN     "homePlayerId" TEXT,
ADD COLUMN     "awayPlayerId" TEXT;

CREATE INDEX "matches_homePlayerId_idx" ON "matches"("homePlayerId");
CREATE INDEX "matches_awayPlayerId_idx" ON "matches"("awayPlayerId");

ALTER TABLE "matches" ADD CONSTRAINT "matches_homePlayerId_fkey" FOREIGN KEY ("homePlayerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_awayPlayerId_fkey" FOREIGN KEY ("awayPlayerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
