-- Round-65 — configurable MVP rating formula + matchday-based appearance.

-- AlterTable: competition holds the organizer-configurable point weights and
-- the minimum appearance % required to be ranked.
ALTER TABLE "competitions" ADD COLUMN     "mvpPtAppearance" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "mvpPtSinglesWon" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "mvpPtDoublesWon" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "mvpPtBreakRun" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "mvpMinAppearancePct" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: per-player matchday appearance counts.
ALTER TABLE "player_comp_stats" ADD COLUMN     "appearanceMatchdays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "teamMatchdays" INTEGER NOT NULL DEFAULT 0;
