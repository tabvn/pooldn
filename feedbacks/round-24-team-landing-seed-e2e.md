# PoolDN — Team Landing Redesign + Bigger Seed + Full E2E (Round 24)

## 1. Team landing page — tabbed redesign with load-more (match Figma + better UX)
The current `/teams/[slug]` is a single long scroll (Roster → Competitions → Recent matches) and won't scale (a team can have many competitions + members). Redesign it (read the Figma team frame via the Figma MCP and match it; improve where the design allows):

- **Tabbed layout** (same tab styling as competition detail): **Overview | Roster | Competitions | Matches | About**.
  - **Overview**: hero summary — team logo, name, captain, member count, record (W/L), current competition(s), a few recent results, key stats. The "at a glance" tab.
  - **Roster**: all members with avatars + role/captain badge. **Paginated / load-more** (teams can have many members; don't render 50 at once). Captain/admin sees manage affordances inline or a "Manage roster" link.
  - **Competitions** (history): EVERY competition the team has entered, newest first, with status chip + the team's result/placement, linked. **Load more** (cursor pagination — a team can have a long history). Optional filter by status (Ongoing / Completed / Upcoming).
  - **Matches**: full match history (opponent, score, W/L, competition, date), **load more**, newest first.
  - **About**: description, captain, home venue/city, created date, aggregate stats.
- **Header** (persistent above tabs): logo, name, captain, member count; actions **Follow / Manage roster (captain/admin) / Edit team (captain/admin) / Request to join (non-member) / Leave (member)**.
- **UI/UX**: match Figma spacing/type/tokens; loading skeletons + empty states per tab; avatars everywhere; deep-link team→competition→match and team→player.
- **Data/perf**: each list (members, competitions, matches) is its own cursor-paginated query (`prismaConnection`) with a "Load more" button (or infinite scroll), so the page stays fast regardless of history size.

## 2. Bigger, richer seed (so scoring/completion variations are visible)
Expand `prisma/seed.ts` so the app shows real variety:
- **More competitions across all statuses**: several DRAFT, several OPEN_FOR_APPLICATIONS, several ONGOING (mid-season with partial results), and several COMPLETED — each with a real `MatchFormatBlock` structure (vary the blocks: 3 Singles+2 Doubles, 5 Singles, Scotch variants, with breaks), different game types and formats, different prize pools/distributions.
- **Full result data** on ongoing/completed: generated matchdays + matches + MatchFrames with players & winners, MatchParticipant stats, standings, MVPs (correctly recomputed), a few **walkover/forfeit** matches, and a couple **score-submission conflicts** awaiting review — so every state/screen has data.
- **Teams with long histories**: give 2–3 teams **many** competition entries (8–12) and **larger rosters** (8–12 members) specifically so the team-landing **load-more** on Competitions and Roster is exercised.
- **Player rating/level data** (round-22, once built): backfill ratings/XP/levels from match results so the leaderboard + profiles show non-default values.
- Keep the one-click demo logins; add the new players.

## 3. Test EVERYTHING end-to-end vs Figma
Run the full per-role e2e matrix (guest/viewer/player/captain/organizer/admin start→end) AND verify each screen against its Figma frame via the Figma MCP. Confirm every function works and matches the design:
- Competition: create wizard (all steps incl. structure) + edit + publish + lifecycle + reopen; applications approve/reject/waitlist; generate matchdays; standings/MVP; About shows real structure; forfeit/reschedule.
- Team: create + invite/accept + join-request/approve + apply-as-team + roster validation + leave/transfer + edit; **team landing tabs + load-more**.
- Match: lineup submission (structure-driven, hidden-until-both) + scoreboard + score submission (auto/conflict) + per-frame walkover.
- Player: public landing (rich + tabbed) + stats + rating/level + leaderboard.
- Platform: shell, notifications (deeplink/realtime/bell), follow + dashboard, media/avatars everywhere, settings (avatar/email/password + verification + country picker + danger zone), admin edit-anything.
- Console-clean on every route. Produce a per-role pass/fail matrix + any remaining gaps, and fix to 100% green.

## 4. Complete end-to-end — do not stop
Work through the entire remaining queue (round-21 team tabs/player redesign/admin-edit-player → round-22 player scoring/level → round-23 settings → round-24 team landing + seed) carefully, UI/UX included, matching Figma, without pausing to ask. After each feature run the suite; at the end post the final per-role pass/fail matrix. Keep going autonomously until everything is implemented, Figma-matched, and the suite is 100% green.

## Definition of done
Team landing is tabbed with paginated competitions/roster/matches matching Figma; the seed shows rich multi-status competition variety with full scoring/completion/walkover/conflict data and large team histories; the full per-role e2e matrix is green; every screen matches its Figma frame; console-clean.
