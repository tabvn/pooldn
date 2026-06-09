-- CreateEnum
CREATE TYPE "MatchCompletionMode" AS ENUM ('AUTO_AGREED', 'ORGANIZER_REVIEW', 'ADMIN_OVERRIDE', 'FORFEIT');

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "completionMode" "MatchCompletionMode";

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
