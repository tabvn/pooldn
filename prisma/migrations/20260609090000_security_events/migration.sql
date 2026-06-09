CREATE TABLE IF NOT EXISTS "security_events" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "kind" TEXT NOT NULL,
  "identifier" TEXT,
  "ip" TEXT,
  "country" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "security_events_userId_createdAt_idx"
  ON "security_events"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "security_events_kind_createdAt_idx"
  ON "security_events"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "security_events_ip_createdAt_idx"
  ON "security_events"("ip", "createdAt");

ALTER TABLE "security_events"
  ADD CONSTRAINT "security_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
