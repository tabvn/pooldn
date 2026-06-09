-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banReason" TEXT;
CREATE INDEX IF NOT EXISTS "users_bannedAt_idx" ON "users"("bannedAt");
-- AlterTable
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3);
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "banReason" TEXT;
CREATE INDEX IF NOT EXISTS "teams_bannedAt_idx" ON "teams"("bannedAt");
