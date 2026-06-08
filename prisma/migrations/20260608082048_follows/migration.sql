-- CreateEnum
CREATE TYPE "FollowEntityType" AS ENUM ('COMPETITION', 'TEAM');

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "FollowEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follows_userId_entityType_idx" ON "follows"("userId", "entityType");

-- CreateIndex
CREATE INDEX "follows_entityType_entityId_idx" ON "follows"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "follows_userId_entityType_entityId_key" ON "follows"("userId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
