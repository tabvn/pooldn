-- Round-49 · organizer-initiated batch invites for competitions.
--
-- Two enum additions, no table changes:
--   ApplicationStatus.INVITED  → seed status for organizer-created rows
--   NotificationType.COMPETITION_INVITE → in-app notification type fired
--   when an invite (or re-invite) is sent.
--
-- The team-side accept flow re-uses the existing applyToCompetition mutation
-- (it now flips an INVITED row to PENDING). Decline routes through
-- withdrawApplication (INVITED → CANCELLED).

ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'INVITED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPETITION_INVITE';
