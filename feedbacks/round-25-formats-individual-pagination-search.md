# PoolDN — Critical Gaps: Formats, Individual Comps, Pagination, Search (Round 25)

Senior code-level audit found these (not covered by rounds 21–24). Prioritized.

## P0 — Competition FORMATS are selectable but only ROUND_ROBIN works
The create wizard offers ROUND_ROBIN / SINGLE_ELIMINATION / DOUBLE_ELIMINATION / SWISS, but `generateMatchdays` only does `bergerPairings` (round-robin). The other three produce nothing/incorrect — a user can create a competition that can never be run. Fix one of two ways:

**Option A (preferred) — implement the formats:**
- **Single elimination**: seed approved teams (by rating/standing or random), generate a bracket (rounds = ceil(log2(N)), byes for non-power-of-2), advance the winner of each match to the next round on completion, crown a champion. Add a **bracket view** UI (replaces the league-standings table for elimination formats) + the final/3rd-place handling.
- **Double elimination**: winners + losers brackets, grand final.
- **Swiss**: pair players/teams with similar records each round for a fixed number of rounds (no elimination); final ranking by score + tie-breakers. 
- `generateMatchdays` branches on `competition.format`; standings/Overview adapts (bracket vs table); advancement runs in the result-approval transaction.

**Option B (MVP cut) — gate the UI:** if elimination/Swiss are out of scope now, **disable/hide** those options in the wizard (only ROUND_ROBIN selectable) with a "coming soon" note, so no one creates an unrunnable competition. Do A if time allows; B at minimum.

## P1 — Individual (non-team) competitions
`CompetitionType.INDIVIDUAL` exists but the whole flow is team-centric (apply by team, standings by team, lineups). Either:
- Implement individual comps: players apply directly (no team), matches are player-vs-player, standings/bracket by player; or
- **Gate it**: hide/disable the INDIVIDUAL type in the wizard until implemented (don't expose a non-working path).

## P1 — List pagination (scale)
Only notifications / match-flow are cursor-paginated. Add `prismaConnection` + "Load more" (or infinite scroll) to: **Poolhub/competitions browse**, **Teams list**, **Venues list**, **Players/leaderboard**, and (per round-24) team Roster/Competitions/Matches. These currently render all rows and won't scale.

## P2 — Global search
No global search exists (only the competition filter + roster search). Add a search (header search box or `/search`) across competitions, teams, players, venues, with typed results and deep-links.

## P2 — Standings tie-breakers
Define + implement explicit tie-break order (points → point difference → points-for → head-to-head) and document it; surface the rule in About.

## Tests
- Format: create a SINGLE_ELIMINATION comp → generate bracket → complete matches → winners advance → champion; (or, if gated, the wizard doesn't offer it).
- Individual: created/played end-to-end, or the type is hidden.
- Pagination: each list loads more without re-rendering everything; large seed exercises it.
- Search returns correct typed results.

## Definition of done
No competition can be created in an unrunnable format/type (formats implemented OR gated); all major lists paginate; global search works; tie-breakers defined; tests green; Figma-matched.
