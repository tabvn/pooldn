-- Per-category participation counts so the Players (MVP rating) table can
-- show PL/W/L/W% for singles and doubles. "Won" counts already existed.
ALTER TABLE "player_comp_stats" ADD COLUMN "singlesPlayed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "player_comp_stats" ADD COLUMN "doublesPlayed" INTEGER NOT NULL DEFAULT 0;
