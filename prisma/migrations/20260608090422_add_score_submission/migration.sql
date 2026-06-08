-- CreateEnum
CREATE TYPE "ScoreSubmissionStatus" AS ENUM ('PENDING', 'AUTO_APPROVED', 'APPROVED', 'CONFLICT', 'REJECTED');

-- CreateTable
CREATE TABLE "match_score_submissions" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "forTeamId" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "framesJson" JSONB,
    "status" "ScoreSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_score_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_score_submissions_matchId_idx" ON "match_score_submissions"("matchId");

-- CreateIndex
CREATE INDEX "match_score_submissions_status_idx" ON "match_score_submissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "match_score_submissions_matchId_submittedById_key" ON "match_score_submissions"("matchId", "submittedById");

-- AddForeignKey
ALTER TABLE "match_score_submissions" ADD CONSTRAINT "match_score_submissions_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_score_submissions" ADD CONSTRAINT "match_score_submissions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_score_submissions" ADD CONSTRAINT "match_score_submissions_forTeamId_fkey" FOREIGN KEY ("forTeamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_score_submissions" ADD CONSTRAINT "match_score_submissions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
