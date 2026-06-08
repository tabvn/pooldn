-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WELCOME', 'APPLICATION_SUBMITTED', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'APPLICATION_WAITLISTED', 'COMPETITION_STARTED', 'COMPETITION_COMPLETED', 'MATCH_SCHEDULED', 'MATCH_RESULT_RECORDED', 'ROSTER_INVITE');

-- CreateEnum
CREATE TYPE "NotificationEntityType" AS ENUM ('COMPETITION', 'APPLICATION', 'MATCH', 'TEAM', 'USER');

-- Drop and recreate the existing rows; seed will repopulate immediately.
DELETE FROM "notifications";

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entitySlug" TEXT,
ADD COLUMN     "entityType" "NotificationEntityType",
ADD COLUMN     "groupKey" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "NotificationType" NOT NULL;

-- CreateIndex
CREATE INDEX "notifications_userId_groupKey_idx" ON "notifications"("userId", "groupKey");

-- CreateIndex
CREATE INDEX "notifications_entityType_entityId_idx" ON "notifications"("entityType", "entityId");
