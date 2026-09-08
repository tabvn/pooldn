-- Round-77 — two-way conversation on a competition application.
--
-- The apply form has always had a "Message to organizer" box, but it wrote
-- only to competition_applications.message, which no UI ever rendered. The
-- organizer got a generic "X applied" ping and had no way to read the note or
-- answer it. This table is the thread behind that box.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPLICATION_MESSAGE';

CREATE TABLE "application_messages" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_messages_applicationId_createdAt_idx"
    ON "application_messages"("applicationId", "createdAt");
CREATE INDEX "application_messages_authorId_idx"
    ON "application_messages"("authorId");

ALTER TABLE "application_messages"
    ADD CONSTRAINT "application_messages_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "competition_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_messages"
    ADD CONSTRAINT "application_messages_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every application that already carries a message becomes the
-- first entry in its own thread, so nothing written through the old form is
-- lost and the UI has a single source to read from.
--
-- An INVITED row's `message` is the ORGANIZER's personal note (written by
-- inviteTeamsToCompetition / invitePlayersToCompetition); every other row's
-- is the applicant's cover note. Attribute each to the right author, and skip
-- any row whose author can't be resolved rather than inventing one.
INSERT INTO "application_messages" ("id", "applicationId", "authorId", "body", "createdAt")
SELECT
    'am_backfill_' || a."id",
    a."id",
    CASE WHEN a."status" = 'INVITED'
         THEN c."organizerId"
         ELSE COALESCE(a."applicantUserId", t."captainId")
    END,
    a."message",
    a."submittedAt"
FROM "competition_applications" a
JOIN "competitions" c ON c."id" = a."competitionId"
LEFT JOIN "teams" t ON t."id" = a."teamId"
WHERE a."message" IS NOT NULL
  AND btrim(a."message") <> ''
  AND CASE WHEN a."status" = 'INVITED'
           THEN c."organizerId"
           ELSE COALESCE(a."applicantUserId", t."captainId")
      END IS NOT NULL;
