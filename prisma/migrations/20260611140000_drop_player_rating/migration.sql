-- Round-54 · drop player rating + level + rating history.
--
-- The MVP doesn't have a points model yet — we'll add a fresh one once
-- the scoring rules are decided. Until then, ratings are dead weight
-- (the score-submission flow never updated them anyway).
--
-- The DROP TABLE clears the FK from users; the column drops use IF
-- EXISTS so re-applying on a partially-migrated env is a no-op.

DROP TABLE IF EXISTS "player_rating_history";

DROP INDEX IF EXISTS "users_rating_idx";

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "rating",
  DROP COLUMN IF EXISTS "level";
