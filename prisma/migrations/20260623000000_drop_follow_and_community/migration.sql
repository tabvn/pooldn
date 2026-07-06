-- MVP simplification — remove the Follow feature and the Community posts
-- feature (feed, trending, comments, reactions, reports, blocks). The
-- Community page is now just the city player directory, which reads from
-- the existing `users` table, so nothing here affects it.
--
-- Idempotent + CASCADE so dependent FKs, indexes, the generated tsvector
-- column, and any attached triggers go with the tables.

DROP TABLE IF EXISTS "follows" CASCADE;
DROP TABLE IF EXISTS "community_reports" CASCADE;
DROP TABLE IF EXISTS "community_blocks" CASCADE;
DROP TABLE IF EXISTS "community_reactions" CASCADE;
DROP TABLE IF EXISTS "community_comments" CASCADE;
DROP TABLE IF EXISTS "community_posts" CASCADE;

-- Enums used only by the dropped tables.
DROP TYPE IF EXISTS "FollowEntityType";
DROP TYPE IF EXISTS "CommunityReactionType";
DROP TYPE IF EXISTS "CommunityReportStatus";
DROP TYPE IF EXISTS "CommunityReportTarget";

-- NOTE: the COMMUNITY_* values on "NotificationType" and the COMMUNITY_POST
-- value on "NotificationEntityType" are intentionally left in place —
-- Postgres can't drop an enum value without recreating the type, and no new
-- rows of those kinds are produced now that the feature is gone.
