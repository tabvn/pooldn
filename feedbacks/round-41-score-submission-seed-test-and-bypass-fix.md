# PoolDN — Score submission: seed test data, fix single-captain bypass, run tests (Round 41)

The dual-confirmation engine (`submitMatchScore` / `reviewMatchScore` in `lib/graphql/resolvers/score-submission.ts`) already implements the agreed rules:
1. **Both captains submit the same score → auto-accept** (both `AUTO_APPROVED`, match `COMPLETED`, `completionMode: AUTO_AGREED`, standings recomputed). ✅
2. **Scores differ → CONFLICT → competition owner reviews/approves** (`reviewMatchScore` → `ORGANIZER_REVIEW`, matching subs `APPROVED`, others `REJECTED`). ✅
3. **ADMIN can do anything** (`SUPER_ADMIN` may submit and resolve any competition → `ADMIN_OVERRIDE`). ✅

Two things to fix/add so we can actually test it and so the rules can't be bypassed.

## 1. BUG (P0) — a single captain can bypass agreement via `submitMatchResult`
`lib/graphql/resolvers/match.mutations.ts → submitMatchResult` marks a match `COMPLETED` with a final score gated only by CASL `ensure(ability,"update","Match")`. But `lib/casl/ability.ts` grants both `TEAM_CAPTAIN` and player-as-captain `can("update","Match", { OR: [homeTeam.captainId, awayTeam.captainId] })`. So **one captain can unilaterally complete a match with any score**, skipping the two-captain agreement (defeats rules 1 & 2).
- **Fix:** captains must go through `submitMatchScore` only. Restrict `submitMatchResult` (direct-complete) to **organizer/admin** (same check as `reviewMatchScore`), or remove it and route the UI's frame-based auto-complete through the submission/agreement path. A captain calling `submitMatchResult` should get FORBIDDEN.
- Keep frame recording (`recordMatchFrame`) for captains, but completing the match must require either two-captain agreement or organizer/admin resolution.

## 2. SEED (P0) — fresh, visible data to test all three paths in the running app
Re-seed (`npm run db:seed`) so an **ONGOING** competition has matches in a submittable state (NOT pre-completed), with captains on known seed accounts, arranged as:
- **A. Auto-agree case:** a `SCHEDULED`/`IN_PROGRESS` match with **no** submissions yet → submit equal scores from both captains → expect AUTO_AGREED + standings move.
- **B. Conflict case:** a match where **one** captain has already submitted (so the other submitting a different score yields CONFLICT), AND at least one match already in `CONFLICT` so the organizer's review queue (`/admin/score-submissions`) has data on load.
- **C. Admin-override case:** a `CONFLICT` match in a competition whose organizer is NOT the admin, so SUPER_ADMIN resolving it records `ADMIN_OVERRIDE`.
- Print the relevant logins to the seed console (organizer, both captains, admin) and the match URLs so they're easy to open. Document the seed accounts in the PR notes.
- Keep the round-31 comprehensive seed intact (completed history, MVP, standings) — just ADD these submittable fixtures.

## 3. TESTS (P0) — run and keep green
- Extend/keep `tests/e2e/score-submission-audit.spec.ts` to cover the **bypass fix** (captain calling `submitMatchResult` → FORBIDDEN) in addition to AUTO_AGREED / ORGANIZER_REVIEW / ADMIN_OVERRIDE.
- Run the full score-submission e2e + unit suite against the new seed and confirm green; report pass counts.

## Definition of done
Captains can only finalize via two-captain agreement or organizer/admin resolution (no `submitMatchResult` bypass); the seed provides ready-to-test auto-agree / conflict / admin-override fixtures with printed logins+URLs; the score-submission test suite is green.
