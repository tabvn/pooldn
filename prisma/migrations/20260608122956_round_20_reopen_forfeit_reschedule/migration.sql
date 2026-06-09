-- CreateEnum
CREATE TYPE "MatchWinType" AS ENUM ('NORMAL', 'WALKOVER', 'FORFEIT', 'DOUBLE_FORFEIT');

-- CreateEnum
CREATE TYPE "RescheduleRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "forfeitReason" TEXT,
ADD COLUMN     "forfeitTeamId" TEXT,
ADD COLUMN     "winType" "MatchWinType" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "leaveReason" TEXT,
ADD COLUMN     "leftAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "match_reschedule_requests" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "proposedDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "RescheduleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_reschedule_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_reschedule_requests_matchId_idx" ON "match_reschedule_requests"("matchId");

-- CreateIndex
CREATE INDEX "match_reschedule_requests_status_idx" ON "match_reschedule_requests"("status");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_forfeitTeamId_fkey" FOREIGN KEY ("forfeitTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_reschedule_requests" ADD CONSTRAINT "match_reschedule_requests_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_reschedule_requests" ADD CONSTRAINT "match_reschedule_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_reschedule_requests" ADD CONSTRAINT "match_reschedule_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
