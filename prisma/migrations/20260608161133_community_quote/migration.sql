-- AlterTable
ALTER TABLE "community_posts" ADD COLUMN     "quotedPostId" TEXT;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_quotedPostId_fkey" FOREIGN KEY ("quotedPostId") REFERENCES "community_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
