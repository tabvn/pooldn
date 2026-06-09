-- AlterTable
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
-- CreateIndex
CREATE INDEX IF NOT EXISTS "cities_isActive_idx" ON "cities"("isActive");
