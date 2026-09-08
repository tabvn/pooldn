-- Round-77 — per-viewer read cursor on an application thread.
--
-- The Messages badge was showing the thread's TOTAL message count, so it never
-- cleared once you'd read it. A thread has two sides, so a single readAt on
-- the message row can't work — the same message is read by the organizer and
-- unread by the applicant. One cursor per (application, user) instead.
CREATE TABLE "application_thread_reads" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_thread_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "application_thread_reads_applicationId_userId_key"
    ON "application_thread_reads"("applicationId", "userId");
CREATE INDEX "application_thread_reads_userId_idx"
    ON "application_thread_reads"("userId");

ALTER TABLE "application_thread_reads"
    ADD CONSTRAINT "application_thread_reads_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "competition_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_thread_reads"
    ADD CONSTRAINT "application_thread_reads_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
