-- Round-49 · outgoing-email queue.
--
-- Backing store for lib/services/email-queue.service.ts. Mutations
-- enqueue rows, a worker (Next.js after() inside the request, or the
-- /api/cron/drain-emails cron for retries) drains PENDING rows and
-- updates them to SENT / FAILED. SKIPPED is set at enqueue-time for
-- *.local test addresses so we don't bounce real SMTP traffic.

CREATE TYPE "OutgoingEmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "outgoing_emails" (
  "id"          TEXT NOT NULL,
  "template"    TEXT NOT NULL,
  "toEmail"     TEXT NOT NULL,
  "payload"     JSONB NOT NULL,
  "status"      "OutgoingEmailStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "lastError"   TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outgoing_emails_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outgoing_emails_status_scheduledAt_idx"
  ON "outgoing_emails"("status", "scheduledAt");
