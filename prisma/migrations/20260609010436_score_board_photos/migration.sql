-- AlterTable
ALTER TABLE "match_score_submissions" ADD COLUMN     "boardImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
