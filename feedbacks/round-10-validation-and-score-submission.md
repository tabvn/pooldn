# PoolDN — Validation, Score Submission Workflow & CRUD Review (Round 10)

Grounded in the code. Two confirmed gaps + a CRUD review.

## A. Roster validation — a player may not be on two teams in the same competition
Today `ApplicationPlayer` is only `@@unique([applicationId, userId])`, and `applyToCompetition` validates captain + competition status but does NOT check whether a selected player is already rostered to another team in the same competition. So the same player can be registered by two teams.

Fix:
- In `applyToCompetition` (and again at `reviewApplication` approve time, to catch races), reject any `playerUserId` that already appears in another application's roster for the same competition where that application's status is PENDING / WAITLISTED / APPROVED. Throw a `GraphQLError` listing the conflicting player name(s) + the team they're already on.
- Enforce in a transaction; add a `rosterUniqueness` guard in a service so both apply and approve use it.
- DB safety net: since a partial cross-row unique can't span the relation directly, add a check + (optionally) a `CompetitionRoster` join (`competitionId, userId` unique) populated on approval to hard-guarantee one team per player per competition.
- UI (apply form): when selecting players, mark/disable those already rostered elsewhere in this competition and show an inline error on submit ("{Player} is already registered with {Team}"). Validation must be visible, not a silent server 500.

## B. Score submission & approval workflow (dual-captain) — NEW
Today `submitMatchResult` lets one side set the score and immediately completes the match + recomputes standings. Required workflow:

Both team captains can submit a score for a match. Resolution:
- If **both captains submit the same score** (and frame detail) → **AUTO-APPROVE**: set the match result, recompute standings, mark the result `AUTO_APPROVED`, and record both submitters.
- If **only one** has submitted → status `PENDING`, notify the other captain to confirm/submit.
- If the two submissions **differ** → status `CONFLICT`; the match is NOT completed; escalate to a higher role (**organizer/org owner** of the competition, or **SUPER_ADMIN**) to review. The reviewer picks the correct submission (or enters the correct score) → `APPROVED`, then result is set + standings recompute. Track who reviewed and when.

Schema:
```prisma
enum ScoreSubmissionStatus { PENDING AUTO_APPROVED APPROVED CONFLICT REJECTED }
model MatchScoreSubmission {
  id            String   @id @default(cuid())
  matchId       String
  match         Match    @relation(fields: [matchId], references: [id], onDelete: Cascade)
  submittedById String                       // captain who submitted
  submittedBy   User     @relation("ScoreSubmittedBy", fields: [submittedById], references: [id])
  forTeamId     String?                       // side the submitter represents
  homeScore     Int
  awayScore     Int
  framesJson    Json?                         // per-frame winners/players for exact compare
  status        ScoreSubmissionStatus @default(PENDING)
  reviewedById  String?
  reviewedBy    User?    @relation("ScoreReviewedBy", fields: [reviewedById], references: [id])
  reviewedAt    DateTime?
  note          String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([matchId, submittedById])          // one current submission per captain per match
  @@index([matchId])
  @@index([status])
}
```

Mutations:
- `submitMatchScore(matchId, homeScore, awayScore, frames)` — captain only (CASL: captain of home or away team). Upsert their submission; then run the resolution logic above (auto-approve / pending / conflict). Standings recompute ONLY on approval (auto or manual), never on first submit.
- `reviewMatchScore(matchId, decision)` — organizer/owner or SUPER_ADMIN only. Resolve a CONFLICT: choose a submission or enter the correct score → APPROVED, set result, recompute, set reviewedBy/reviewedAt.
- Keep an audit trail: every submission row persists (who/when/what); approval records the reviewer (or "auto").

Notifications (via NotificationService): first submit → notify the other captain to confirm; conflict → notify organizer/owner; resolution → notify both captains.

UI:
- **Match flow / match detail**: captain submit-score action; state banner — "Waiting for {OtherTeam} captain to confirm", "Auto-approved ✓", or "In review (scores don't match)".
- **Score Submissions list** — for the organizer (their competition) and SUPER_ADMIN (all): a table of submissions showing match, both captains' submitted scores, submitted-by + time, status (with CONFLICT highlighted), reviewed-by + time, and an Approve/Resolve action on conflicts. This is the "list of score submissions, track who submitted and who reviewed" requirement. Auto-approved rows show reviewer = "Auto".
- Match status: add a `DISPUTED` state (or reuse IN_PROGRESS) so a conflicted match is clearly not final.

## C. CRUD flexibility review (all entities)
Make every entity's CRUD complete and flexible (partial updates, proper edit/delete, permissions):
- Competition: create/edit(draft)/delete + lifecycle (have create+lifecycle; add edit/delete per round-8/9).
- Team: create/edit/delete + roster add/remove (add edit/delete per round-8). Captain can edit their application roster before approval.
- Venue: full CRUD (read-only today — round-8).
- Application: edit roster before review; withdraw/cancel; re-apply after rejection.
- Matchday/Match: organizer edit (reschedule, set venue), regenerate.
- Profile/User: edit + avatar.
- Community post: edit/delete own.
Each with CASL ownership rules + per-role tests (non-owner blocked) + inline validation + toasts + confirms.

## Tests
- Roster: two teams try to register the same player in one competition → second apply (and approve) is rejected with a clear error; apply form disables the already-rostered player.
- Score: both captains submit equal scores → auto-approved, match completed, standings updated, both tracked. Captains submit different scores → CONFLICT, match not completed, organizer resolves → approved + reviewer tracked. Submissions list shows submitter + reviewer for each.
- CRUD: create→edit→delete happy path + non-owner blocked, per entity.

## My standing process (primary reviewer)
Going forward I will, without being asked: open each screen as it ships, compare it to its Figma frame, test the functionality and validation, list what's missing or wrong, and write the next plan for you to execute — proactively, at a senior bar.
