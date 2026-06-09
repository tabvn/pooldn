-- AlterTable
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "homeVenueId" TEXT;
-- Index
CREATE INDEX IF NOT EXISTS "teams_homeVenueId_idx" ON "teams"("homeVenueId");
-- FK
ALTER TABLE "teams"
  ADD CONSTRAINT "teams_homeVenueId_fkey"
  FOREIGN KEY ("homeVenueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
