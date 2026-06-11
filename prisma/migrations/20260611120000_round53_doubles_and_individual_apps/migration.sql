-- Round-53 · CompetitionType.DOUBLES + individual-applicant column on
-- CompetitionApplication.
--
-- 1. Enum addition is non-destructive; existing TEAMS/INDIVIDUAL rows are
--    untouched.
-- 2. competition_applications.teamId becomes nullable so INDIVIDUAL apps
--    can record `applicantUserId` instead. We add a separate uniqueness
--    constraint on (competitionId, applicantUserId).
-- 3. Old constraint @@unique([competitionId, teamId]) keeps working — it's
--    already (competitionId, teamId) and Postgres allows multiple NULL
--    teamId values without violating it.

ALTER TYPE "CompetitionType" ADD VALUE IF NOT EXISTS 'DOUBLES';

ALTER TABLE "competition_applications"
  ALTER COLUMN "teamId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "applicantUserId" TEXT;

CREATE INDEX IF NOT EXISTS "competition_applications_applicantUserId_idx"
  ON "competition_applications"("applicantUserId");

CREATE UNIQUE INDEX IF NOT EXISTS
  "competition_applications_competitionId_applicantUserId_key"
  ON "competition_applications"("competitionId", "applicantUserId");

ALTER TABLE "competition_applications"
  ADD CONSTRAINT "competition_applications_applicantUserId_fkey"
    FOREIGN KEY ("applicantUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
