-- Round-88 — self-service claiming of shell (placeholder) profiles.
--
-- Until now the only way to take over a shell was a secret /claim/<token> link
-- the organizer handed out. That still exists, but it strands anyone who never
-- got a link: they can see their own name on a roster and have no way to say
-- "that's me". This table is that request, reviewed by an organizer of a
-- competition the shell plays in (or an admin).

CREATE TYPE "ShellClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SHELL_CLAIM_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SHELL_CLAIM_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SHELL_CLAIM_REJECTED';

-- A placeholder team: created so a competition can include a side that isn't
-- on Play Pool yet, alongside its real teams.
ALTER TABLE "teams" ADD COLUMN "isShell" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "teams_isShell_idx" ON "teams"("isShell");

-- Backfill: every team the offline-league import created (i.e. one that still
-- has an unclaimed placeholder on its roster) is a shell team. Teams whose
-- members have all been claimed are left alone — they're real teams now.
UPDATE "teams" t
SET "isShell" = true
WHERE EXISTS (
    SELECT 1
    FROM "team_members" tm
    JOIN "users" u ON u."id" = tm."userId"
    WHERE tm."teamId" = t."id" AND u."isShell" = true
);

CREATE TABLE "shell_claim_requests" (
    "id" TEXT NOT NULL,
    -- Nullable: approving the claim DELETES the shell row (everything it owns
    -- moves to the requester), and this decision record has to outlive it.
    -- shellName / shellUsername are the copies the reviewed list renders after.
    "shellUserId" TEXT,
    "shellName" TEXT NOT NULL,
    "shellUsername" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "ShellClaimStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shell_claim_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shell_claim_requests_shellUserId_status_idx"
    ON "shell_claim_requests"("shellUserId", "status");
CREATE INDEX "shell_claim_requests_requesterId_status_idx"
    ON "shell_claim_requests"("requesterId", "status");
CREATE INDEX "shell_claim_requests_status_createdAt_idx"
    ON "shell_claim_requests"("status", "createdAt");

ALTER TABLE "shell_claim_requests"
    ADD CONSTRAINT "shell_claim_requests_shellUserId_fkey"
    FOREIGN KEY ("shellUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shell_claim_requests"
    ADD CONSTRAINT "shell_claim_requests_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shell_claim_requests"
    ADD CONSTRAINT "shell_claim_requests_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
