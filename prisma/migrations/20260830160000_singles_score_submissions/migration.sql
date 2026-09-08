-- Round-79 — Singles matches finalize by dual confirmation, like team matches.
--
-- Until now recordMatchFrame auto-completed a 1v1 the moment either player's
-- frame tally reached the race-to target, so ONE player could unilaterally
-- close the match at whatever score they had entered. Singles now goes
-- through MatchScoreSubmission like every other format: both players confirm,
-- agreement auto-completes, disagreement raises a CONFLICT for the organizer.
--
-- A submission is made FOR a side: a team on TEAMS/DOUBLES, the player
-- themselves on Singles. forTeamId therefore becomes nullable and forUserId
-- joins it; exactly one is set per row.
ALTER TABLE "match_score_submissions" ALTER COLUMN "forTeamId" DROP NOT NULL;
ALTER TABLE "match_score_submissions" ADD COLUMN "forUserId" TEXT;

CREATE INDEX "match_score_submissions_forUserId_idx"
    ON "match_score_submissions"("forUserId");

ALTER TABLE "match_score_submissions"
    ADD CONSTRAINT "match_score_submissions_forUserId_fkey"
    FOREIGN KEY ("forUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
