-- Round-60 — per-block, sequential team-match lineup submission.

-- Stable block reference on each frame (set at scaffold time).
ALTER TABLE "match_frames" ADD COLUMN IF NOT EXISTS "blockOrder" INTEGER;
CREATE INDEX IF NOT EXISTS "match_frames_matchId_blockOrder_idx"
  ON "match_frames"("matchId", "blockOrder");

-- Which block a pending lineup-edit request targets.
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "lineupEditRequestedBlockOrder" INTEGER;

-- Per-block, per-side lineup submission rows.
CREATE TABLE IF NOT EXISTS "match_block_lineups" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "blockOrder" INTEGER NOT NULL,
  "submittedById" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "match_block_lineups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "match_block_lineups_matchId_side_blockOrder_key"
  ON "match_block_lineups"("matchId", "side", "blockOrder");
CREATE INDEX IF NOT EXISTS "match_block_lineups_matchId_idx"
  ON "match_block_lineups"("matchId");

DO $$ BEGIN
  ALTER TABLE "match_block_lineups"
    ADD CONSTRAINT "match_block_lineups_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "match_block_lineups"
    ADD CONSTRAINT "match_block_lineups_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
