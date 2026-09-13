/*
  Warnings:

  - You are about to drop the column `searchVector` on the `community_posts` table. All the data in the column will be lost.
  - You are about to drop the column `searchVector` on the `competitions` table. All the data in the column will be lost.
  - You are about to drop the column `searchVector` on the `teams` table. All the data in the column will be lost.
  - You are about to drop the column `searchVector` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `searchVector` on the `venues` table. All the data in the column will be lost.

  ── Replay note ──────────────────────────────────────────────────────────────
  This migration was generated against a dev database whose `roster_change_*`
  tables already existed, but the migration that CREATES them
  (20260610190000_round50_locks_and_roster_changes) sorts *after* this one. On
  a database that already ran this migration nothing changes — Prisma never
  re-applies a recorded migration. On a fresh database (a container, a new
  environment) the guards below let it replay cleanly instead of dying with
  `relation "roster_change_players" does not exist`.

  The dropped `searchVector` columns and their indexes get the same treatment:
  they are re-created later by round50_restore_search_fts, and may not exist
  yet at this point in a clean replay.
*/
-- DropForeignKey
DO $$ BEGIN
  IF to_regclass('"roster_change_players"') IS NOT NULL THEN
    ALTER TABLE "roster_change_players" DROP CONSTRAINT IF EXISTS "roster_change_players_userId_fkey";
  END IF;
END $$;

-- DropForeignKey
DO $$ BEGIN
  IF to_regclass('"roster_change_requests"') IS NOT NULL THEN
    ALTER TABLE "roster_change_requests" DROP CONSTRAINT IF EXISTS "roster_change_requests_requestedById_fkey";
  END IF;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "community_posts_search_vector_idx";

-- DropIndex
DROP INDEX IF EXISTS "competitions_centralVenueId_idx";

-- DropIndex
DROP INDEX IF EXISTS "competitions_search_vector_idx";

-- DropIndex
DROP INDEX IF EXISTS "teams_bannedAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "teams_homeVenueId_idx";

-- DropIndex
DROP INDEX IF EXISTS "teams_search_vector_idx";

-- DropIndex
DROP INDEX IF EXISTS "users_search_vector_idx";

-- DropIndex
DROP INDEX IF EXISTS "venues_search_vector_idx";

-- AlterTable
ALTER TABLE "community_posts" DROP COLUMN IF EXISTS "searchVector";

-- AlterTable
ALTER TABLE "competitions" DROP COLUMN IF EXISTS "searchVector";

-- AlterTable
ALTER TABLE "teams" DROP COLUMN IF EXISTS "searchVector";

-- AlterTable
ALTER TABLE "users" DROP COLUMN IF EXISTS "searchVector";

-- AlterTable
ALTER TABLE "venues" DROP COLUMN IF EXISTS "searchVector";

-- AddForeignKey
DO $$ BEGIN
  IF to_regclass('"roster_change_requests"') IS NOT NULL THEN
    ALTER TABLE "roster_change_requests" ADD CONSTRAINT "roster_change_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF to_regclass('"roster_change_players"') IS NOT NULL THEN
    ALTER TABLE "roster_change_players" ADD CONSTRAINT "roster_change_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
