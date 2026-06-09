# PoolDN — Comprehensive Seed for Full Testing (Round 31)

Extends round-24's seed work. Goal: rich, realistic data so EVERY screen + variation can be tested. **Every competition must have a full setup** (no half-configured comps).

## Every competition fully set up
For each seeded competition (across ALL statuses), populate the complete config:
- Basics: name, description, **banner image**, game type, format, type, city.
- **Match structure**: a real `MatchFormatBlock` set (vary them — e.g. 5 Singles; 3 Singles + break + 2 Doubles; Scotch variants), with breaks + Break & Run on some.
- Participants config (min/max teams + players), application deadline, prize pool + **prizeDistribution** (1st/2nd/3rd), points + tie-breakers, rulesUrl on some.
- Applications: a mix of APPROVED / PENDING / WAITLISTED / REJECTED / CANCELLED teams.
- Schedule: generated matchdays + matches.

## Variations to cover
- **Statuses**: several DRAFT, several OPEN_FOR_APPLICATIONS, several ONGOING (mid-season, partial results), several COMPLETED.
- **Formats**: round-robin populated; if elimination/Swiss are gated, only seed round-robin; if implemented, seed at least one bracket comp.
- Varied game types (8/9/10-ball, straight), team sizes, prize amounts/currencies, cities.

## Full result data (ongoing + completed)
- Matchdays + matches + **MatchFrames with players assigned + winners** (from the structure), MatchParticipant stats, standings, correct **MVP** (recomputed), a few **walkover/forfeit** matches, and a couple **score-submission conflicts** awaiting review.
- A couple **postponed/rescheduled** matches + a pending **reschedule request**.

## Teams & players
- ~16–20 players (avatars, cities, nationalities). 6–8 teams; give **2–3 teams long histories (8–12 competitions) + large rosters (8–12 members)** to exercise load-more.
- A couple **pending team invitations** + **join requests** so those flows have data.

## New entities to seed (so their pages aren't empty)
- **Player ratings/XP/levels** backfilled from match results (round-22) → leaderboard + profiles show real values.
- **Followers**: seed users following several competitions and teams (varying counts, some with many) → the followers page + counts have data and load-more is exercised.
- **Feedback**: a handful of `Feedback` rows in mixed statuses (NEW/REVIEWING/RESOLVED) from different users → the admin feedback inbox has data.
- **Community posts** (with a few likes/comments once those exist).
- **Notifications** across types so the bell + inbox are populated.

## Also: createTeam slug-collision bug (same pattern as the apply bug)
`createTeam` writes `slug: args.input.slug` with no duplicate guard — Team.slug is `@unique`, so creating a team whose name/slug already exists crashes on the unique constraint (raw error). Fix: validate slug uniqueness upfront (or catch the constraint) and return a friendly "That team name is already taken — pick another" via the round-26 error helper. Auto-suffix the slug (`-2`) or ask the user to change the name. Test: creating two teams with the same name shows a friendly error, not a 500.

## Keep
- The one-click demo logins (add the new players); idempotent re-seed (`npm run db:seed`).

## Definition of done
`npm run db:seed` yields a fully-populated app: every competition fully configured with structure + results, all statuses/variations present, teams with long histories + large rosters, ratings/leaderboard/followers/feedback/notifications all seeded — so every screen and the per-role e2e matrix have real data. Tests still green after re-seed.
