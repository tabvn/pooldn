# PoolDN — Feedback / Bug log

Running log of bugs found during review, what caused them, the fix, and the test that now guards against regression.

Last updated: 2026-06-08

---

## Bug log

### B-001 · Sidebar Poolhub link 404
- **Symptom**: clicking "Poolhub" in the sidebar from any non-home page returned 404.
- **Root cause**: sidebar nav item pointed to `/poolhub` but the Poolhub page is the index of the `(shell)` route group (`/`).
- **Fix**: `components/layout/sidebar.tsx` — nav item href changed to `/`.
- **Test**: `tests/e2e/navigation.spec.ts` — "sidebar links navigate to each section".

### B-002 · Matchdays and applications had non-deterministic order
- **Symptom**: matchday list rendered in random order; applications too.
- **Root cause**: Pothos `prismaObject` relations had no `orderBy`.
- **Fix**: `lib/graphql/types/competition.ts` — matchdays ordered by `number asc`, applications by `submittedAt desc`.
- **Test**: covered by competition tab assertions (anonymous tabs test + applications page test).

### B-003 · Match page showed "Match not found" while loading
- **Symptom**: brief flash of "Match not found" on `/matches/[id]` until Apollo's first response.
- **Root cause**: loading state conflated with empty result.
- **Fix**: `app/(shell)/matches/[id]/match-flow.tsx` — render "Loading…" when `loading && !match`.
- **Test**: covered indirectly by "captain can open the seeded match".

### B-004 · Notification bell did nothing on click
- **Symptom**: `<button>` element with no handler.
- **Root cause**: header bell was a placeholder.
- **Fix**: `components/layout/header.tsx` — converted to `<Link href="/notifications">`.
- **Test**: `tests/e2e/navigation.spec.ts` — "header notification bell goes to /notifications".

### B-005 · No "Create competition" CTA exposed
- **Symptom**: organizers had no entry point to `/competitions/new`.
- **Root cause**: missing surface in Poolhub.
- **Fix**: `app/(shell)/page.tsx` — RSC reads the viewer; renders `<Button>Create competition</Button>` when role is ORGANIZER or SUPER_ADMIN.
- **Test**: `tests/e2e/competition-flow.spec.ts` — "organizer sees Create competition CTA and can publish".

### B-006 · Anonymous users could submit organizer/captain forms and only learn at submit
- **Symptom**: anyone could open `/competitions/new`, fill the form, submit, and get a server FORBIDDEN error.
- **Root cause**: pages were client components with no auth gate.
- **Fix**: refactored `/competitions/new`, `/competitions/[slug]/apply`, `/competitions/[slug]/applications`, `/matches/[id]`, `/notifications` into server wrappers using `requireViewer({ next, roles })` from `lib/auth/server.ts` — anonymous traffic is redirected to `/sign-in?next=…`, role-mismatched traffic to `/`.
- **Test**: covered by "anon user is redirected to sign-in" (apply, match, notifications) and "non-organizer is redirected away from applications".

### B-007 · Sign-in `?next=` ignored by demo-account quick-login
- **Symptom**: signing in via a demo account always landed on `/`, even when the user had been bounced from `/notifications`.
- **Root cause**: `DemoAccounts` did `router.push("/")` unconditionally.
- **Fix**: `components/auth/demo-accounts.tsx` — reads `useSearchParams().get("next")`.
- **Test**: `tests/e2e/auth.spec.ts` — "Sign In honors ?next= redirect".

### B-008 · "Max teams (optional)" failed validation when blank
- **Symptom**: leaving Max teams empty raised "Too small: expected number to be >=2" on submit.
- **Root cause**: `z.coerce.number().min(2).optional()` coerces `""` to `0`, failing `min(2)` before `.optional()`.
- **Fix**: `app/(shell)/competitions/new/form.tsx` — `optionalCount(min)` wraps the field in `z.preprocess` that maps `""`/`null` to `undefined`; `optionalDate` does the same for date fields.
- **Test**: `tests/e2e/competition-flow.spec.ts` — "organizer creates a competition and lands on its detail" passes with Max teams left blank.

### B-009 · `Field` label not associated with its input
- **Symptom**: `page.getByLabel("Name")` could not find the input (Playwright + a11y).
- **Root cause**: the local `Field` helper used `<Label>` with no `htmlFor` and a sibling `<Input>` with no `id`.
- **Fix**: `app/(shell)/competitions/new/form.tsx` — `Field` now wraps the input in a `<label>` element directly, so the association is intrinsic.
- **Test**: same competition-flow test covers it.

### B-010 · Defaulted numeric inputs blank on first render
- **Symptom**: RHF `defaultValues: { minTeams: 2 }` didn't propagate to the DOM `<input type="number">`, so a user who never touched the field submitted `""` → coerced to 0 → validation failure.
- **Root cause**: RHF's defaultValues populate stored state but don't always reach the DOM `value` attribute for uncontrolled numeric inputs.
- **Fix**: each defaulted numeric input now also has an explicit `defaultValue={…}` DOM prop. Same for `currency = "VND"`.
- **Test**: covered by the same happy-path test above.

### B-011 · /login and /register routes 404
- **Symptom**: external bookmarks / inbound links to `/login` or `/register` 404'd.
- **Root cause**: actual routes are `/sign-in` and `/sign-up`.
- **Fix**: `app/login/page.tsx` and `app/register/page.tsx` emit a server-side `redirect()` (HTTP 307).
- **Test**: smoke check returns 307 on both routes (see STEP 1 stabilize log).

### B-012 · Header city badge format inconsistent across logged-in/-out states
- **Symptom**: anonymous header read "Da Nang, Vietnam"; authenticated showed only "Da Nang".
- **Root cause**: `ViewerQuery` returned `city.name` only; the format string used the raw value.
- **Fix**: extended `ViewerQuery` to include `city.country.name`; the shell layout now formats as `"${city}, ${country}"`. Default for anon stays `"Da Nang, Vietnam"`.
- **Test**: covered by the "matches the design" + "demo-account quick login" auth tests indirectly; visual confirmation pending role-walk.

### B-013 · Standings seed: head-to-head 5-3 had identical PF/PA for both teams
- **Symptom**: both Gen Filling Station and Da Nang Tigers showed `PF=5/PA=3/PD=+2`, which is impossible for a single match.
- **Root cause**: original seed copy-pasted the same row data for both teams.
- **Fix**: `prisma/seed.ts` — winner gets `PF=5/PA=3/PD=+2`, loser gets `PF=3/PA=5/PD=-2`. Same pattern applied to the ongoing competition's standings computed from the seeded match results.
- **Test**: not asserted directly; verifiable in the Overview tab and via the GraphQL `competition(slug)` query.

### B-014 · Apollo RSC reads ran without the request's session cookie
- **Symptom**: even after `set-cookie` from `login`, the shell layout's `ViewerQuery` returned `null` and the header stayed in "Sign in" mode until a manual refresh.
- **Root cause**: `registerApolloClient`'s `HttpLink` doesn't auto-forward incoming request cookies to the API call.
- **Fix**: `lib/apollo/client.ts` — `setContext` link that reads `(await cookies()).toString()` and appends as the `cookie` header on every RSC request.
- **Test**: `tests/e2e/auth.spec.ts` — "can sign in via the form, see identity, and sign out" relies on this.

### B-015 · `codegen:watch` didn't actually watch the schema source
- **Symptom**: after editing a Pothos resolver/type, running `codegen:watch` left the SDL stale, so `graphql()` queries that referenced new fields silently fell back to plain strings → "You must wrap the query string in a gql tag" runtime error.
- **Root cause**: `graphql-codegen --watch` only watches the SDL file; nothing watched the TS source that produces the SDL.
- **Fix**: `package.json` — new `schema:watch` script (nodemon on `lib/graphql/{types,resolvers,builder,schema,context}.ts`) runs `npm run schema:print` on change; `codegen:watch` now runs both via `concurrently`. Also installed `@parcel/watcher` (required by `graphql-codegen --watch`).

### B-016 · Teams card body click did not navigate (real-browser only)
- **Symptom**: clicking the card body on `/teams` (anywhere other than text) did not navigate. `e.defaultPrevented` was `false` at document capture but `true` at document bubble — preventDefault was called but `router.push` skipped. Headless Playwright `locator.click()` succeeded (false-green); real-browser click failed.
- **Root cause**: card structure used `<Link><Card><CardContent><Avatar/>…</CardContent></Card></Link>`. The `Avatar`'s `<img>` (when a logoUrl was set) plus surrounding flex layout intercepted the click in a way that aborted Next.js's navigation.
- **Fix**: restructured the Teams card to mirror the working Competitions-card layout (`<CardHeader>` + `<CardTitle>` + `<CardContent>`, no Avatar inside the Link). Each Link also got a `data-testid="team-card-${slug}"` for strict targeting.
- **Test**: `tests/e2e/directories.spec.ts` — two new tests: "team cards REALLY navigate when clicked (not synthetic)" asserts `toHaveURL("/teams/…")` after `.click()`, and "team cards navigate when clicking on the card body (not text)" uses `page.mouse.click` on the card's bounding box centroid.

### B-017 · Sign In missing "Forgot password?" link per Figma
- **Symptom**: Figma frame shows a "Forgot password?" link next to the Password label; live build had none.
- **Root cause**: simply not built yet.
- **Fix**: `app/(auth)/sign-in/page.tsx` — header row with `<Label>` and a `Link` to `/forgot-password`. New `/forgot-password` page explains that reset isn't wired and to ask the organizer for now.
- **Test**: covered by the next test pass — to be added in the Sign In design assertions.

### B-018 · Logout test was UI-only and didn't verify cookie removal
- **Symptom**: prior tests asserted the URL was `/sign-in` after sign-out, but the server-side session cookie could in principle still be present.
- **Root cause**: tests didn't inspect cookies or re-query the API after logout.
- **Fix**: new `tests/e2e/logout.spec.ts` — two tests: (1) inspects the browser context's `pooldn_session` cookie before/after sign-out and confirms it's cleared, (2) issues a `viewer { username }` GraphQL query via `page.request.post` (shared cookies) before/after sign-out and confirms it flips from the username to `null`.
- **Test**: `tests/e2e/logout.spec.ts`.

### B-019 · Match flow page used generic "Frame"/"Score" labels and a flat form (Figma drift)
- **Symptom**: deviation from the Figma's Match Flow Captain View, which uses "Match Lineups", "Game N" cards with clickable player slots ("Click to select the winner"), and a "Confirm match results" CTA gated on every game being decided.
- **Root cause**: original implementation was a quick form-based version.
- **Fix**: `app/(shell)/matches/[id]/match-flow.tsx` rewritten:
  - Scoreboard with two `TeamSide` cards (avatar + name + `score / raceTo`, leader highlighted in primary).
  - `Match Lineups` card listing each recorded game as a card with `Game N` header, undecided/winner badge, and two clickable `PlayerSlot`s — clicking a player declares them the winner (upserts the frame with `homeWon`).
  - Add-game form (Game #, Home/Away player names, "Add game" button).
  - Footer status strip with contextual copy ("X games still need a winner" / "Race-to target reached. Confirm the result." / "All games are played. Confirm match results.") + "Confirm match result (h–a)" button disabled until every game has a decided winner.
- **Test**: `tests/e2e/match.spec.ts` — "captain can open the seeded match" asserts "Match Lineups" + "Race to" labels; "logout from match flow lands at /sign-in" covers cross-page logout.

### B-020 · Apply form was bare (team + message only)
- **Symptom**: Figma Team Captain Application flow specifies Team, Home Venue, multi-select Roster ("Select X to Y players"), and message. Live form had only Team + message.
- **Root cause**: minimum viable Apply was shipped first.
- **Fix**: `app/(shell)/competitions/[slug]/apply/form.tsx` — Team selector drives a `TeamDetailQuery` for the roster; Home Venue selector uses `VenuesListQuery`; Roster section renders checkbox cards per team member (avatar + name + @username + nationality), with a live count badge that flips warning → success once `minPlayersPerTeam` is satisfied. Helper text is sourced from the competition's `min/maxPlayersPerTeam`.
- **Test**: smoke "captain sees the apply form populated with their teams"; deeper interaction left to mentor walk.

### B-022 · DRAFT competitions leaked to the public Poolhub feed
- **Symptom**: Anonymous (and any signed-in) viewers saw DRAFT competitions, including stale `e2e-*` test rows from Playwright runs.
- **Root cause**: the CASL public read rule was `can("read", "Competition", { isPublic: true })` with no status filter. DRAFT competitions default `isPublic: true`.
- **Fix**: `lib/casl/ability.ts` — the public baseline now requires `status: { in: ["OPEN_FOR_APPLICATIONS", "APPLICATIONS_CLOSED", "ONGOING", "COMPLETED"] }`. Organizers still see their own DRAFTs via the per-role rule (`can("manage", "Competition", { organizerId })`); admins see everything.
- **Test**: `Role walk — */` Poolhub assertions still pass; manual: signing out shows only the 3 non-draft seeded competitions.

### B-023 · Stale Playwright/mentor test competitions polluted the seeded Poolhub
- **Symptom**: ~7 e2e + 1 mentor-test-cup rows persisted across seed runs.
- **Root cause**: nothing cleaned them up; seed only upserted canonical fixtures.
- **Fix**: `prisma/seed.ts` — top-of-`main()` cleanup deletes any competition whose slug starts with `e2e-` or `mentor-`. Reports the count + slugs in the seed log.
- **Test**: seed output: `seed: cleaned 7 test competitions: …`.

### B-024 · Winner / MVP banner showed on non-COMPLETED competitions
- **Symptom**: ONGOING competitions (e.g. Da Nang Autumn Invitational, mid-season) rendered the purple gradient "Winner!" / "MVP" banner with the current standings leader, before the season ended.
- **Root cause**: Overview tab unconditionally rendered the banner whenever standings existed.
- **Fix**: `app/(shell)/competitions/[slug]/page.tsx` — banner block is now gated on `c.status === "COMPLETED"`. The `CompetitionOverviewQuery` was extended to include `status`.
- **Test**: implicit in the role walk's "Overview tab" smoke (no banner unless COMPLETED); FEEDBACK matrix flips automatically because the assertion is "League Standings" text, not the banner.

### B-025 · Rejected teams appeared in League Standings
- **Symptom**: Pool Sharks (REJECTED application) still surfaced in the Autumn Invitational standings table.
- **Root cause**: seed wrote a Standing row for them; the recompute service didn't gate on application status either.
- **Fix**:
  - `lib/services/standings.service.ts` — recompute now (1) loads the set of APPROVED team IDs for the competition, (2) `deleteMany`s any Standing rows for teams not in that set, (3) seeds the table with zero-row stats for each approved team, (4) ignores matches involving non-approved teams.
  - `prisma/seed.ts` — drops the sharks Standing entry, replaces all sharks matches with valid round-robin pairings between the three approved teams (Gen, Tigers, Hai), and now `deleteMany`s the ongoing competition's matches+standings before re-creating them so a re-run never accumulates orphan pairings.
- **Test**: spot-check via the GraphQL `competition(slug: "da-nang-autumn-invitational-2026") { standings { team { name } } }` — only Gen / Tigers / Hai are returned.

### B-026 · UI polish to match Figma fidelity
- **Symptom (mentor P2)**: lifecycle actions as a row of buttons; header meta as plain text; standings rows had no team avatar; native browser selects + date inputs clashed with the dark theme.
- **Fix**:
  - Lifecycle actions now collapse into a **kebab overflow menu** (`MoreVertical` icon → Base UI Menu dropdown). New `components/ui/dropdown-menu.tsx`. The available actions adapt to current status (Publish on DRAFT, Close/Start/Cancel on OPEN, Complete/Cancel on ONGOING, etc.). Each item has its lucide icon (`Rocket`, `Lock`, `CirclePlay`, `CheckCircle2`, `XCircle`); the destructive Cancel item gets a separator + the danger color variant.
  - Header meta is now **icon chips** (`components/ui/icon-chip.tsx`) with bordered backgrounds and lucide icons: status chip · trophy chip (format · gameType) · calendar chip (date range) · map-pin chip (city) · users chip (team capacity) · trophy/success chip (prize). Replaces the prior mix of `Badge` + plain text.
  - Standings rows render the team `Avatar` (sm) alongside the team name.
  - Native `<select>` elements replaced with a styled Base UI `Select` (`components/ui/select.tsx`) — accessible, keyboard-navigable, dark-theme aligned, with hover/highlight states and a check indicator on the selected item. Used for Game type, Format, Type, and City in the Create competition form (via RHF `Controller`).
  - Native `<input type="date">` now sits inside a `color-scheme: dark` document, and its native calendar icon is recolored to the lime accent via a `filter` rule in `globals.css`. (A custom calendar popover is a follow-up if the native one is still off-brand on the mentor's OS.)
- **Test**: `tests/e2e/lifecycle.spec.ts` rewritten — asserts `getByTestId("lifecycle-menu")` visibility per role, clicks the kebab and asserts the menu items by role. 5 tests, all green.

---

### B-027 · CASL leak — organizers saw every competition (incl. other orgs' DRAFTs)
- **Symptom (senior pass)**: `ability.ts` ORGANIZER branch had an unconditional `can("read", "Competition")`. Logged in as Michael, the Toronto Bayside Cup DRAFT (owned by Alex) plus e2e DRAFT leagues were visible on Poolhub.
- **Fix**: `lib/casl/ability.ts` — removed the unscoped read; organizers still see published comps via the guest baseline and their own at every status via `can("manage", "Competition", { organizerId: actor.id })`.
- **Test**: `tests/e2e/casl-visibility.spec.ts` — 4 tests: anon sees only published, organizer A doesn't see organizer B's DRAFT, organizer B sees their own DRAFT, super-admin sees all.

### B-028 · Notifications upgrade — typed/deeplink/connection/realtime/group/centralize
- **Symptom (senior pass)**: free-string `type`, `metadata` JSON not exposed, cards not clickable, returned every row, no live badge.
- **Fix**: see [§ Notifications](./FEEDBACK.md#b-028) below — promoted to typed enums + entity/deeplink/groupKey columns; `NotificationConnection` cursor pagination; live unread badge with 30s poll; `NotificationService.create()` is the single write path; inbox has type-accent left border, per-type icon, inline group expand, relative time, toast on mark-all-read.
- **Tests**: `tests/e2e/notifications-consistency.spec.ts` — bell count ≡ first-page unread.

### B-029 · Inbox/bell could disagree (id-then-refetch envelope)
- **Symptom (senior pass)**: bell=1, inbox=empty. Suspected the `NotificationConnection` envelope's `select:{id}` + `findMany({id IN [...]})` could drop rows.
- **Fix**: parent resolver fetches full Notification rows once; `nodes` field returns them via `t.prismaField` passthrough. No re-query.

### B-030 · Match completion didn't notify the captains / organizer
- **Fix**: `submitMatchResult` now fans out a `MATCH_RESULT_RECORDED` group in the same `$transaction` as the match update + standings recompute.

### B-031 · Application review didn't notify captain/team
- **Fix**: `reviewApplication` now fans out `APPLICATION_APPROVED|REJECTED` to the captain + every team member.

### F-001 · Feature backlog landed
- **Profile + Settings**: `/profile/[username]` (public read) and `/settings` (auth-gated self-edit form) using `updateProfile` mutation. Toast on save; viewer-menu dropdown links to both.
- **Poolhub filters**: client component (`PoolhubFilters`) drives `searchParams`; server page parses and validates `status` / `gameType` / `cityId` / `search`; CASL `accessibleBy` still applies.
- **Matchday auto-generation**: `generateMatchdays(id)` runs Berger round-robin (`lib/services/scheduling.service.ts`) inside `$transaction`, bulk-creating matchdays + matches via `createMany`, then fanning out `MATCH_SCHEDULED` to organizer + each captain. Organizer surfaces a "Generate matchdays" button on the empty matchdays tab.
- **Team mgmt**: `/teams/new` creates a team (captain auto-set), redirects to `/teams/[slug]/manage`. Roster page lets the captain search the user directory and add/remove players with toasts and confirms.
- **Community feed**: new `CommunityPost` model + `communityPosts` query + `createCommunityPost` mutation. `/community` shows a signed-in compose box (Cmd-Enter to post) + a relative-time feed with author avatars.
- **Apply→Approve→Standings e2e**: `tests/e2e/apply-approve-standings.spec.ts` walks the full captain-applies → organizer-approves chain.
- **Shared components**: `<CompetitionCard>` and `<MetaChips>` extracted to `components/competition/` and used by Poolhub + competition layout. `<ToastProvider>` mounted in `ApolloWrapper` exposes `useToast()` everywhere.

### B-021 · Competition lifecycle had only Publish
- **Symptom**: no UI to move past OPEN_FOR_APPLICATIONS — organizers couldn't close applications, start the season, complete, or cancel.
- **Root cause**: missing resolvers + UI.
- **Fix**: `lib/graphql/resolvers/competition.mutations.ts` — added `closeApplications`, `startCompetition`, `completeCompetition`, `cancelCompetition` via a shared `transition()` helper that checks the `from` status + CASL `update` permission on the Competition subject. `components/competition/lifecycle-actions.tsx` is a client component that renders the right action buttons for the current status; mounted in the competition layout's PageTitle `actions` slot for the owning organizer or SUPER_ADMIN. The layout's "manage" gate is now ownership-based (`viewer.id === c.organizer.id`), not just role-based — a non-owning organizer no longer sees the Applications tab or lifecycle buttons on someone else's competition.
- **Test**: `tests/e2e/lifecycle.spec.ts` — 5 tests covering: organizer sees Close/Start/Cancel on OPEN, no actions on COMPLETED, captain sees Apply CTA instead, non-owning organizer sees no actions (ownership), super-admin sees actions on any competition.

---

## Role walk — pass/fail matrix

Filled in from the automated `tests/e2e/role-walk.spec.ts` suite. ✓ = behavior is correct for that role per the matrix in the spec.

| Page / Feature | toan (SUPER) | michael (ORG) | thomas (CAP) | gen (CAP) | hai (CAP) | player1 | player2 | viewer |
|---|---|---|---|---|---|---|---|---|
| Demo login from `/sign-in` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/` Poolhub list | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create competition CTA visible | ✓ shown | ✓ shown | ✓ hidden | ✓ hidden | ✓ hidden | ✓ hidden | ✓ hidden | ✓ hidden |
| `/competitions/[slug]` Overview tab | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/competitions/[slug]/applications` | ✓ access | ✓ access | ✓ → / | ✓ → / | ✓ → / | ✓ → / | ✓ → / | ✓ → / |
| `/competitions/[slug]/apply` | ✓ access | ✓ → / | ✓ access | ✓ access | ✓ access | ✓ → / | ✓ → / | ✓ → / |
| `/competitions/new` | ✓ access | ✓ access | ✓ → / | ✓ → / | ✓ → / | ✓ → / | ✓ → / | ✓ → / |
| `/teams` + detail (incl. card body click) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/venues` + detail | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/notifications` inbox | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sign out → `/sign-in` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Notes:
- "✓ hidden" = the affordance is correctly NOT rendered for that role (PLAYER/VIEWER don't see Create competition).
- "✓ → /" = role tried the protected route, was correctly redirected to `/` by `requireViewer({ roles })`.
- The Apply test uses `/competitions/spring-open-2027/apply` (the only competition currently `OPEN_FOR_APPLICATIONS`); admins are also allowed by the role array (`["TEAM_CAPTAIN", "SUPER_ADMIN"]`).

Total: **103 / 103 Playwright tests passing** (after the kebab refactor + P1/P2 changes).

## Remaining risks

- **No CSRF protection on the GraphQL endpoint.** The session cookie is `SameSite=Lax` which covers most cross-origin attacks, but a mutation submitted from a same-site origin (e.g. a comment box that allows HTML) would carry the cookie. Acceptable for MVP; add a CSRF token on mutations before production.
- **Standings recompute is best-effort.** `recomputeStandings` runs inside the `submitMatchResult` transaction, but doesn't run on direct `Match` updates by an admin (e.g. via Prisma Studio). If an organizer edits scores outside the mutation, standings drift.
- **No team-create UI yet.** Captains rely on seeded teams to apply. A `/teams/new` form is on the list.
- **Competition lifecycle is partial.** Only `publish` is wired. `close applications`, `start`, `complete`, `cancel` aren't surfaced in the UI yet.
- **No CSRF / rate-limit on register**: easy to spam accounts. Add throttling and a basic CAPTCHA before public deployment.
- **No CASL-aware MutationFilter on resolvers** for ApplicationPlayer, Notification beyond the explicit guards.
