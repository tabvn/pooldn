CREATE TABLE IF NOT EXISTS "email_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "pendingEmail" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_tokens_tokenHash_key" ON "email_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "email_tokens_userId_purpose_idx" ON "email_tokens"("userId", "purpose");

ALTER TABLE "email_tokens"
  ADD CONSTRAINT "email_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
