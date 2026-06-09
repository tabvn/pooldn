ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "lineupEditRequestedById" TEXT;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "lineupEditRequestedAt" TIMESTAMP(3);
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "lineupEditRequestedSide" TEXT;
