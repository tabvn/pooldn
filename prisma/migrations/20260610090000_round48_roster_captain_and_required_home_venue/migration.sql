-- Round-48 — captain audit gaps:
--   1. Per-competition Roster Captain on CompetitionApplication
--   2. requiresHomeVenue gate on Competition
--   3. ROSTER_CAPTAIN_ASSIGNED notification type

ALTER TYPE "NotificationType" ADD VALUE 'ROSTER_CAPTAIN_ASSIGNED';

ALTER TABLE "competitions"
  ADD COLUMN "requiresHomeVenue" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "competition_applications"
  ADD COLUMN "rosterCaptainUserId" TEXT;

ALTER TABLE "competition_applications"
  ADD CONSTRAINT "competition_applications_rosterCaptainUserId_fkey"
  FOREIGN KEY ("rosterCaptainUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "competition_applications_rosterCaptainUserId_idx"
  ON "competition_applications"("rosterCaptainUserId");
