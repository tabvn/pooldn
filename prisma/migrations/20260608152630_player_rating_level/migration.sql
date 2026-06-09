-- AlterTable
ALTER TABLE "users" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 1000;

-- CreateIndex
CREATE INDEX "users_rating_idx" ON "users"("rating");
