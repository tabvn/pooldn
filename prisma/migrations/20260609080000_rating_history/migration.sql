CREATE TABLE IF NOT EXISTS "player_rating_history" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "delta" INTEGER NOT NULL,
  "outcome" TEXT NOT NULL,
  "opponentId" TEXT,
  "matchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_rating_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "player_rating_history_userId_createdAt_idx"
  ON "player_rating_history"("userId", "createdAt");

ALTER TABLE "player_rating_history"
  ADD CONSTRAINT "player_rating_history_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
