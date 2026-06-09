-- Round-34 · global full-text search.
--
-- We index the text-bearing surface of each searchable entity into a
-- generated tsvector column and put a GIN index on it. Generated columns
-- keep the vector always in sync with the underlying text — every UPDATE
-- on the source columns reapplies `to_tsvector`, so no triggers needed.
--
-- 'simple' dictionary (not 'english') because PoolDN data is multilingual
-- (Vietnamese / English / numbers / slugs). simple keeps every token
-- without language-aware stemming or stop-word removal, which is the right
-- call for names/usernames/slugs.

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
