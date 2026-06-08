# PoolDN — Role-Based End-to-End Test Plan (Production Readiness)

Goal: prove every screen is reachable, connected, and functional for each role, start → end, with correct authorization. Implement as Playwright e2e where possible; the rest is a manual QA checklist. Each role uses the one-click demo login (pw `password123`). Re-seed (`npm run db:seed`) before a full pass.

Pass criteria per step: page renders (no 500/empty crash), data is correct, every link/button goes somewhere valid, mutations show a toast, destructive actions confirm, and authz hides/blocks what the role shouldn't access.

## Cross-cutting (all roles)
- Every sidebar item (Poolhub, Teams, Venues, Community) and header control (location selector, bell → /notifications, account menu) navigates correctly.
- No route 404s that are linked in the UI; no link points to a dead page.
- Unread bell badge matches the inbox; notifications deeplink to the right entity.
- Loading and empty states render (no infinite spinners, no blank pages).
- Back/forward navigation keeps state; refresh on any deep link works (SSR/guards).
- Sign out clears the session server-side; protected routes then redirect to /sign-in.

## 1. Guest (not signed in)
1. Visit `/` → redirected to /sign-in (or public Poolhub if guests allowed). Verify "Continue as Guest".
2. As guest: Poolhub shows only PUBLIC, non-DRAFT competitions; Teams/Venues read-only.
3. Open a competition → Overview/Standings/Matchdays/Players/About visible; **no** organizer actions, **no** Apply (or Apply prompts sign-in).
4. Attempt `/competitions/new`, `/notifications`, `/teams/new`, `/competitions/{slug}/apply` → redirected to sign-in.
5. Sign up flow (`/sign-up`) creates an account and lands logged-in.

## 2. Viewer (@viewer)
1. Login → Poolhub dashboard (greeting, Today's Match if any, Upcoming/Active sections).
2. Browse competitions, teams, venues, community feed — all read-only.
3. Notifications inbox loads (own rows only), mark-read + mark-all work, deeplinks navigate.
4. No create/manage/apply controls anywhere; direct nav to organizer/captain routes is blocked.

## 3. Player (@player1 / @player2)
1. Login → dashboard. Confirm any competition the player is in surfaces (Today's Match / active).
2. Competition → Players tab shows their stats (matches, frames, win%, MVP).
3. Profile page shows their info + stats; Settings allows self-edit only (cannot edit others).
4. Community: can compose + post; post appears in feed with avatar linking to profile.
5. Cannot create competitions/teams, cannot approve applications, cannot record match results.

## 4. Team Captain (@thomas / @gen / @hai)
1. Login → dashboard; "Manage roster" CTA appears for teams they captain.
2. Team manage (`/teams/{slug}/manage`): search + add player, remove player (confirm dialog + toast). Verify roster persists.
3. Create team (`/teams/new`): RHF form, captain auto-set; "New Team Created" confirmation.
4. **Apply flow** (`/competitions/{slug}/apply` on an OPEN competition): select team, choose roster/lineup, message, submit → application appears as PENDING; captain gets/can see status; organizer notified.
5. **Match Flow (Captain View)** on a scheduled match where they captain a side:
   - Open Match Details → submit lineup (Singles + Doubles slots). Confirm "lineups hidden until both captains submit".
   - After both submit → frames revealed; record winners per frame; "All games played — confirm" finalizes.
   - Standings recompute; both captains + organizer get MATCH_RESULT_RECORDED notifications; Players stats update.
6. Authz: cannot manage teams they don't captain, cannot edit other competitions, cannot approve applications.

## 5. Organizer (@michael / @alex)
1. Login → dashboard + "Create competition" visible.
2. **Create competition** (wizard/form) → lands in DRAFT (Pre-Start view).
3. **Draft visibility**: their own DRAFT shows to them; a DIFFERENT organizer's DRAFT must NOT appear on their Poolhub (CASL regression — verify @michael cannot see @alex's toronto draft).
4. Lifecycle via kebab: Open applications → Applications tab shows PENDING/APPROVED/WAITLISTED/REJECTED/CANCELLED; Approve/Reject/Waitlist update status + notify captain; approved team enters standings only.
5. **Generate matchdays** (when empty) → matchdays + matches created in one transaction; schedule shows; teams notified (MATCH_SCHEDULED).
6. Start → Ongoing; Complete → Completed (winner/MVP banner appears only now); Cancel → confirm dialog.
7. Authz: can only manage own competitions/matchdays/matches/applications; cannot edit @alex's.

## 6. Super Admin (@toan)
1. Login → can see everything incl. all drafts and all competitions.
2. Can manage any competition/team/venue (spot-check edit on an entity owned by someone else).
3. Confirm admin-only affordances are gated to SUPER_ADMIN (no leakage to organizer/player).

## Connectivity matrix (verify no orphan screens)
For each screen, assert at least one in-app path reaches it and it links onward:
Poolhub ↔ Competition detail ↔ (Matchdays → Match detail/flow), (Applications → Apply), (Players → Profile); Teams ↔ Team detail ↔ Team manage / Create team; Venues ↔ Venue detail; Community ↔ Profile; Notifications → entity deeplinks; Account menu → Profile/Settings/Sign out.

## Automated coverage to add (Playwright)
- `guest-redirects.spec` — protected routes bounce to sign-in.
- `viewer-readonly.spec` — no mutating controls; blocked routes.
- `captain-apply-to-standings.spec` — apply → organizer approve → lineup submit (both) → record frames → confirm → standings + notifications. (Extend the existing apply-approve-standings spec into the full match flow.)
- `organizer-lifecycle.spec` — create → open → generate matchdays → start → complete; winner only on COMPLETED.
- `casl-visibility.spec` — organizer A can't see organizer B's draft (already added — keep).
- `notifications-consistency.spec` — bell count === inbox unread; deeplinks resolve (already added — keep).
- `account-menu.spec` — profile/settings/sign-out; sign-out clears server session.

## Reporting
Run `npm run test:e2e` (reuses the running dev server). Produce a pass/fail matrix by role and a list of any orphan/broken screens. Fix reds, then re-run until 100% green. Target: a full green pass = production-ready for the MVP scope.
