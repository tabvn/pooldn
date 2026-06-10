-- Round-50 · competition-level locks (registration / roster) + captain-
-- initiated roster change requests that require organizer review.
--
-- 1. Competition.registrationLocked / rosterLocked — independent of `status`.
-- 2. RosterChangeRequestStatus enum + roster_change_requests table.
-- 3. roster_change_players (proposed roster snapshot, one row per player).

-- 1) Competition locks (default false → existing rows unchanged)
ALTER TABLE "competitions"
  ADD COLUMN "registrationLocked" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "rosterLocked"        BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Roster change request status enum
CREATE TYPE "RosterChangeRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

-- 3) roster_change_requests table
CREATE TABLE "roster_change_requests" (
  "id"            TEXT PRIMARY KEY,
  "applicationId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "status"        "RosterChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "message"       TEXT,
  "reviewNote"    TEXT,
  "reviewedById"  TEXT,
  "reviewedAt"    TIMESTAMP(3),
  "submittedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "roster_change_requests_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "competition_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "roster_change_requests_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "roster_change_requests_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "roster_change_requests_applicationId_idx"
  ON "roster_change_requests" ("applicationId");
CREATE INDEX "roster_change_requests_status_idx"
  ON "roster_change_requests" ("status");
CREATE INDEX "roster_change_requests_requestedById_idx"
  ON "roster_change_requests" ("requestedById");

-- 4) roster_change_players — proposed roster snapshot for each request
CREATE TABLE "roster_change_players" (
  "id"        TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  CONSTRAINT "roster_change_players_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "roster_change_requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "roster_change_players_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "roster_change_players_requestId_userId_key"
  ON "roster_change_players" ("requestId", "userId");
CREATE INDEX "roster_change_players_userId_idx"
  ON "roster_change_players" ("userId");
