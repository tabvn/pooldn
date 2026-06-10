-- Round-48 (wizard) — Figma Schedule/Participants fields plus Application Mode.

-- AlterEnum (add new SchedulingType values)
ALTER TYPE "SchedulingType" ADD VALUE 'WEEKLY_ROUNDS';
ALTER TYPE "SchedulingType" ADD VALUE 'FIXED_MATCHDAYS';

-- CreateEnum
CREATE TYPE "ApplicationMode" AS ENUM ('OPEN', 'INVITE_ONLY');
CREATE TYPE "MatchVenueMode" AS ENUM ('TEAM_VENUES', 'CENTRAL_VENUE');

-- AlterTable Competition
ALTER TABLE "competitions"
  ADD COLUMN "applicationMode" "ApplicationMode" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "invitedTeamIds" JSONB,
  ADD COLUMN "matchVenueMode" "MatchVenueMode" NOT NULL DEFAULT 'TEAM_VENUES',
  ADD COLUMN "centralVenueId" TEXT,
  ADD COLUMN "gamesPerOpponent" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "weekdaySchedule" JSONB;

ALTER TABLE "competitions"
  ADD CONSTRAINT "competitions_centralVenueId_fkey"
  FOREIGN KEY ("centralVenueId") REFERENCES "venues"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "competitions_centralVenueId_idx" ON "competitions"("centralVenueId");
