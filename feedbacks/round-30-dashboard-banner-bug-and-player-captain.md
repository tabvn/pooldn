# PoolDN — Dashboard Upcoming-card banner bug + Player→Captain (Round 30)

## 1. BUG — "Upcoming competitions" card has no cover image
In `lib/graphql/operations/dashboard.operations.ts`, the `upcoming: competitions(filters:{status:OPEN_FOR_APPLICATIONS})` selection set **does not include `bannerUrl`**, while other sections (viewerNextMatch.competition, myFollowedCompetitions) do. The shared `CompetitionCard` renders the uploaded banner when `c.bannerUrl` is set, otherwise a gradient fallback — so the upcoming cards always show the gradient, never the real cover.

Fix:
- Add `bannerUrl` to the `upcoming` selection (and verify the `active` competitions selection includes it too — the dashboard reads `data.active`; make sure that field/selection also fetches `bannerUrl`).
- Re-test: an OPEN competition with an uploaded banner shows its cover on the dashboard Upcoming card; one without shows the gradient.
- Audit all CompetitionCard usages (Poolhub/competitions browse, team competitions tab, follow lists) to ensure each query feeding a card selects `bannerUrl` — same bug could exist elsewhere.

## 2. Player → become a team captain by creating a team
Confirm/implement: any signed-in **player can create a team and becomes its captain**.
- `/teams/new` → `createTeam` sets `captainId = creator`. (Verify a PLAYER role can reach `/teams/new` — CASL allows create Team for signed-in users; the "Create team" CTA should be visible to players, not only existing captains.)
- On creating a team, the creator is its captain (can manage roster, invite, apply to competitions, submit lineups/scores). Optionally bump the user's role to TEAM_CAPTAIN, or keep role=PLAYER and treat captaincy via `team.captainId` (recommend the latter — captaincy is per-team, not a global role).
- Surface "Create a team" prominently for players with no team (e.g., the "My Teams" empty state from round-29: "You're not on a team yet — create one"), so a player can self-serve into captaincy.
- Test: a PLAYER creates a team → is captain → can invite/manage/apply; a player can captain one team and be a member of another.

## 3. Followers page (who follows this competition/team) + load-more
Follow exists (a user follows competitions/teams), but the **reverse list** — who follows a given entity — isn't surfaced. Add it:
- Query `followers(entityType: COMPETITION|TEAM, entityId, first, after)` — a **cursor-paginated** connection of the users following that entity (newest first), with a `followerCount`.
- **Followers count** on the competition/team detail header (e.g., "1,204 followers") that is **clickable** → a followers list.
- A followers **page/screen** (e.g. `/competitions/[slug]/followers`, `/teams/[slug]/followers`, or a modal/drawer) showing each follower: avatar + name + @username (deep-link to their player profile) + a **Follow/Following back** button. **Load more** (or infinite scroll) for many followers.
- Reusable `<FollowerList>` component used for both competitions and teams (and reusable later for player followers if players become followable).
- Public-readable; empty state ("No followers yet").

### Tests
- A competition/team with N followers shows the correct count; opening the list shows them, paginates via Load more.
- Each follower row deep-links to the profile; follow-back toggles.
- Empty state when no followers.

## Definition of done
Upcoming (and all) competition cards show the real banner when set; players can create a team and act as its captain end-to-end; a paginated Followers list/page exists for competitions and teams with a clickable count + load-more; tests green.
