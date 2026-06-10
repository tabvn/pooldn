/*
  Warnings:

  - You are about to drop the column `searchVector` on the `community_posts` table. All the data in the column will be lost.
  - You are about to drop the column `searchVector` on the `competitions` table. All the data in the column will be lost.
  - You are about to drop the column `searchVector` on the `teams` table. All the data in the column will be lost.
  - You are about to drop the column `searchVector` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `searchVector` on the `venues` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "roster_change_players" DROP CONSTRAINT "roster_change_players_userId_fkey";

-- DropForeignKey
ALTER TABLE "roster_change_requests" DROP CONSTRAINT "roster_change_requests_requestedById_fkey";

-- DropIndex
DROP INDEX "community_posts_search_vector_idx";

-- DropIndex
DROP INDEX "competitions_centralVenueId_idx";

-- DropIndex
DROP INDEX "competitions_search_vector_idx";

-- DropIndex
DROP INDEX "teams_bannedAt_idx";

-- DropIndex
DROP INDEX "teams_homeVenueId_idx";

-- DropIndex
DROP INDEX "teams_search_vector_idx";

-- DropIndex
DROP INDEX "users_search_vector_idx";

-- DropIndex
DROP INDEX "venues_search_vector_idx";

-- AlterTable
ALTER TABLE "community_posts" DROP COLUMN "searchVector";

-- AlterTable
ALTER TABLE "competitions" DROP COLUMN "searchVector";

-- AlterTable
ALTER TABLE "teams" DROP COLUMN "searchVector";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "searchVector";

-- AlterTable
ALTER TABLE "venues" DROP COLUMN "searchVector";

-- AddForeignKey
ALTER TABLE "roster_change_requests" ADD CONSTRAINT "roster_change_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_change_players" ADD CONSTRAINT "roster_change_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
