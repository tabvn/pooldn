-- Round-50 · restore the full-text-search columns + GIN indexes that an
-- earlier `prisma migrate dev` accidentally dropped (the unnamed
-- 20260610035948 migration cleared them because the columns were never in
-- schema.prisma — they were added via raw SQL in Round-34).
--
-- This re-applies the original Round-34 setup verbatim. The IF NOT EXISTS
-- guards keep it idempotent: if a DB still has the columns, the migration
-- is a no-op; if they were dropped, the columns + indexes come back. We
-- also add `searchVector Unsupported("tsvector")?` to schema.prisma in the
-- same change so future drift-detection runs treat the columns as
-- intentional and never produce a destructive drop migration again.

-- Users -----------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce("name", '') || ' ' ||
      coalesce("username", '') || ' ' ||
      coalesce("bio", '')
    )
  ) STORED;
CREATE INDEX IF NOT EXISTS "users_search_vector_idx"
  ON "users" USING GIN ("searchVector");

-- Teams -----------------------------------------------------------------
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce("name", '') || ' ' ||
      coalesce("slug", '') || ' ' ||
      coalesce("description", '')
    )
  ) STORED;
CREATE INDEX IF NOT EXISTS "teams_search_vector_idx"
  ON "teams" USING GIN ("searchVector");

-- Competitions ----------------------------------------------------------
ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce("name", '') || ' ' ||
      coalesce("slug", '') || ' ' ||
      coalesce("description", '')
    )
  ) STORED;
CREATE INDEX IF NOT EXISTS "competitions_search_vector_idx"
  ON "competitions" USING GIN ("searchVector");

-- Venues ----------------------------------------------------------------
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce("name", '') || ' ' ||
      coalesce("slug", '') || ' ' ||
      coalesce("address", '')
    )
  ) STORED;
CREATE INDEX IF NOT EXISTS "venues_search_vector_idx"
  ON "venues" USING GIN ("searchVector");

-- Community posts -------------------------------------------------------
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce("body", ''))
  ) STORED;
CREATE INDEX IF NOT EXISTS "community_posts_search_vector_idx"
  ON "community_posts" USING GIN ("searchVector");
