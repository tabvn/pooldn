# Round 48 — Captain role: Roster Captain, Team Venues, and required-venue gate

Closes the **P0 gaps** identified in the Figma vs ship audit (2026-06-09). All three are needed before the Team Captain Application flow matches the Figma spec end-to-end.

Sections in the design file (`3nV5z8JLbKU8qzifEERIQM`):
- `356:19451` — **Team Captain Application** (frames: Select Roster, Roster Item Selector, Select a Roster Captain, Application Mode, Home Venues, "This competition requires each team to have a home venue.", Your Application, Preview Application).
- `403:15238` — **Match Flow — Captain View** (frames consume the Roster Captain authz).

Pull the exact copy + layout from the Figma MCP per node when implementing each task — don't paraphrase.

---

## TASK A — Per-competition Roster Captain (the captain who isn't playing)

**Figma copy on the frame (verbatim):**
> "Since you're not participating, select a player to act as captain for this competition (manage lineups and confirm results)."

### A.1 Schema (Prisma)
Pick one — A is the cleaner model:

**Option A (recommended):** add `rosterCaptainUserId` to `CompetitionApplication`.
```prisma
model CompetitionApplication {
  // …existing fields
  rosterCaptainUserId String?
  rosterCaptain       User?   @relation("ApplicationRosterCaptain", fields: [rosterCaptainUserId], references: [id])
  @@index([rosterCaptainUserId])
}
```
- Nullable. When null, the team captain plays AND runs match flow (the current path).
- Set when the team captain isn't in the application's player roster; must be one of the `ApplicationPlayer.userId` values for that application.

**Option B:** add `isRosterCaptain: Boolean @default(false)` on `ApplicationPlayer` with a partial unique on `(applicationId)` where `isRosterCaptain = true`. Slightly more relational, but requires a partial index and reads less obvious.

→ **Go with Option A.** Migration: `alter table competition_applications add column "rosterCaptainUserId" text references users(id);` + index.

### A.2 Apply flow (`app/(shell)/competitions/[slug]/apply/form.tsx`)
Current steps: Team → Roster → Message → Review. After A this becomes 4 or 5 steps:
- Step 2 (Roster): keep.
- **NEW Step 2.5 (Application Mode + Roster Captain):**
  - Auto-detect: if the team captain (`viewer.id`) is NOT in the selected roster, force this step. If they ARE, skip — they're the captain by default.
  - Card title: "Application Mode" (matches Figma frame name).
  - Toggle/`<Choice>`: **"I'm playing"** (default, only enabled when captain is in the roster) vs **"I'm not playing — nominate a Roster Captain"**.
  - When "not playing": render the Roster Captain selector — dropdown of `ApplicationPlayer`s from this submission. The selected user becomes `rosterCaptainUserId`.
  - Inline copy verbatim: "Since you're not participating, select a player to act as captain for this competition (manage lineups and confirm results)."
- Step Review: show selected Roster Captain in the summary card.

### A.3 Mutation
Extend `applyToCompetition` input:
```ts
input ApplyToCompetitionInput {
  competitionId: ID!
  teamId: ID!
  playerUserIds: [ID!]!
  message: String
  rosterCaptainUserId: ID   # NEW — must be one of playerUserIds when set
  homeVenueId: ID           # see Task C
}
```
Server validation:
- If `rosterCaptainUserId` is set, it MUST be in `playerUserIds` (DB constraint via a check in the resolver — Prisma can't express it).
- If the viewer (team captain) is NOT in `playerUserIds`, `rosterCaptainUserId` is REQUIRED.

### A.4 Authorization (match flow)
`SubmitLineup`, `RecordFrameMutation`, `MarkFrameWalkover`, `SubmitMatchScore`, `RequestLineupEdit`, `ApproveLineupEdit`, `RejectLineupEdit`, `RequestMatchReschedule` all currently allow only **Team.captainId**. Update the actor check to:

> Allowed if viewer is `Team.captainId` **OR** viewer is `CompetitionApplication.rosterCaptainUserId` for that team's application in this competition.

Add a helper `lib/auth/match-actor.ts` that takes `(viewer, matchId)` and returns the set of `(teamId, role)` pairs they're allowed to act for. Use it in every match resolver. CASL rules updated accordingly.

### A.5 UI surfacing
- On the match detail page, badge the acting user: "You're the Roster Captain for {Team}" so the player understands why they have write access.
- On the team page, surface "Roster Captain for {Competition}" on the player chip if `rosterCaptainUserId === player.userId` for any active application.

### A.6 Tests
1. Captain in roster → no extra step, current behavior unchanged.
2. Captain NOT in roster → step appears; submitting without a Roster Captain → server rejects.
3. Roster Captain submits lineup + score → succeeds; team captain (not playing) also succeeds (both have authz).
4. A non-captain non-roster-captain player → blocked from lineup mutations.

---

## TASK B — Team Venues editor for the captain

**Figma frame names:** Team Venues, Home Venues, Home Venue, "Where Matches Are Played".

### B.1 Schema (already there)
`Team.homeVenueId String?` exists. No migration needed.

### B.2 Editor UI on `/teams/[slug]/manage`
Add a "Home Venue" card next to the roster card with:
- Read-only display of current `homeVenue.name` + `homeVenue.city.name` if set, or the empty-state "No home venue yet — set one so this team can apply to competitions that require it."
- Button: "Change home venue" → opens a Combobox with `VenuesListQuery` (scoped to the team's city, fall back to all cities with a search).
- Mutation: `UpdateTeam(homeVenueId)` already exists (or add the field if not).

### B.3 Visibility on team detail
On `/teams/[slug]`, show the home venue chip below the team name (matches Figma's "Where Matches Are Played" line).

### B.4 Tests
- Captain on manage page sets a home venue → reload → shows on team detail.
- Non-captain → editor not rendered.

---

## TASK C — Competition `requiresHomeVenue` gate

**Figma frame copy:** "This competition requires each team to have a home venue."

### C.1 Schema
```prisma
model Competition {
  // …
  requiresHomeVenue Boolean @default(false)
}
```
Migration: `alter table competitions add column "requiresHomeVenue" boolean not null default false;`

### C.2 Organizer-side surfacing
- In `/competitions/new` and `/competitions/[slug]/edit`, add a Switch in the scheduling/rules section: "Require each team to have a registered home venue". Default off.

### C.3 Apply-flow gate
In `app/(shell)/competitions/[slug]/apply/form.tsx`:
- Read `competition.requiresHomeVenue` and the selected `team.homeVenueId`.
- If `requiresHomeVenue && !team.homeVenueId`, block step 1 with the verbatim Figma copy: "This competition requires each team to have a home venue." + a deeplink **"Set a home venue for {Team}"** → `/teams/[slug]/manage` (open in new tab so the user doesn't lose apply state).
- Server-side: `applyToCompetition` rejects the same case as a final guard.

### C.4 Tests
- Comp with `requiresHomeVenue = true`, team with no venue → apply blocked with the deeplink visible.
- Same comp, team with venue → apply proceeds.

---

## Cross-cutting

### Migration
Single migration `2026XXXX_round48_roster_captain_and_required_home_venue`:
```sql
alter table competition_applications add column "rosterCaptainUserId" text references users(id);
create index "competition_applications_rosterCaptainUserId_idx"
  on competition_applications("rosterCaptainUserId");
alter table competitions add column "requiresHomeVenue" boolean not null default false;
```

### GraphQL surface
- `CompetitionApplication.rosterCaptain: User`
- `Competition.requiresHomeVenue: Boolean!`
- `ApplyToCompetitionInput.rosterCaptainUserId: ID`
- `ApplyToCompetitionInput.homeVenueId: ID` (already accepted as optional; now possibly enforced)

### Notifications
- New type `ROSTER_CAPTAIN_ASSIGNED` → notifies the chosen player on apply: "{TeamCaptain} nominated you as the Roster Captain for {Competition}."
- Existing `MATCH_SCHEDULED` / `LINEUP_EDIT_REQUEST` etc. resolve recipient via the Roster Captain when set, otherwise the Team Captain.

### Permissions reference (CASL)
Add to `lib/casl/competition.rules.ts` (or wherever match rules live):
```ts
can(["update"], "Match", {
  matchday: { is: { competition: { is: {
    applications: { some: {
      rosterCaptainUserId: actor.id,
      OR: [
        { teamId: { equals: matchHomeTeamIdRef } },
        { teamId: { equals: matchAwayTeamIdRef } },
      ],
    } }
  } } } }
})
```
(Polish the Prisma filter syntax in code — the intent is "the viewer is the roster captain for at least one of the match's teams in this competition.")

---

## Definition of done

- Migration applied; no manual db touch-ups needed.
- Apply flow shows the new Application Mode step only when needed; copy matches Figma verbatim.
- Captain who isn't playing can submit the application + later run match flow as Roster Captain.
- Team manage page has a Home Venue card the captain can use.
- Competitions with `requiresHomeVenue = true` block apply until the team sets a venue, with the exact Figma message + a deeplink to set it.
- New Playwright specs cover the 4 captain paths in Task A.6 and the gates in B.4 / C.4.
- No TypeScript errors; existing tests still pass.
