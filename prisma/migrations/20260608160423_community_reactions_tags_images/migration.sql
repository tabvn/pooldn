/*
  Warnings:

  - You are about to drop the `community_likes` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CommunityReactionType" AS ENUM ('LIKE', 'FIRE', 'LAUGH', 'CLAP', 'TROPHY');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMMUNITY_MENTION';

-- DropForeignKey
ALTER TABLE "community_likes" DROP CONSTRAINT "community_likes_postId_fkey";

-- DropForeignKey
ALTER TABLE "community_likes" DROP CONSTRAINT "community_likes_userId_fkey";

-- AlterTable
ALTER TABLE "community_posts" ADD COLUMN     "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "community_likes";

-- CreateTable
CREATE TABLE "community_reactions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CommunityReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_reactions_postId_type_idx" ON "community_reactions"("postId", "type");

-- CreateIndex
CREATE INDEX "community_reactions_userId_idx" ON "community_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_reactions_postId_userId_type_key" ON "community_reactions"("postId", "userId", "type");

-- CreateIndex
CREATE INDEX "community_posts_tags_idx" ON "community_posts"("tags");

-- AddForeignKey
ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
