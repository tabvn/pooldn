# PoolDN — A→Z multi-role live E2E test report (Round 43)

Tested live in the running app using the demo quick-login per role (no passwords typed). Date 2026-06-09.

## ✅ Verified working (live)
**Guest / auth**
- Guest can browse the hub, competitions, teams, venues; header shows "Sign in".
- Sign-in screen: Welcome heading, Google/Facebook (coming soon), email+password, Forgot password, **Continue as Guest**, Sign Up, demo-accounts panel.
- Sign-up screen: Given/Family name, Email, Password + Re-enter, Create Account, Continue as Guest.
- Login works for every role via demo quick-login.

**Player (An / player2)**
- **Create-team wizard** (4 steps: Basics → Invite members → Review → Done): slug auto-generates (`cue-breakers-qa`), review summary correct, team created with creator as captain.
- **Invite member**: player search works; queued Linh; invitation fired on create.
- **Apply to competition** (4-step wizard: team → roster pick → note → confirm): submitted; competition CTA flips to **PENDING / Withdraw / "Application submitted, under review."**

**Captain collaboration**
- **Accept invite** (round-33 banner on team page): "Cue Breakers QA invited you to join — Decline / Accept"; Accept → invite cleared, banner gone, Linh joined the roster (members = An + Linh).
- Team page has the new **tabs** (Overview / Roster / Competitions / Matches / About) — round-21/24.

**Organizer (Michael)**
- **Applications management** page: approve/reject per application + pre-start setup panel. Approved Cue Breakers QA → status APPROVED (accept-team-request-to-join-competition ✓).

**Score submission (the 3 rules) — live**
- **Rule 1 (both captains same → auto-accept):** gen + hai both 3–2 → both `AUTO_APPROVED`, match `COMPLETED`, `completionMode: AUTO_AGREED`, standings recompute. ✓
- **Rule 2 (differ → conflict):** gen 5–3 vs hai 3–2 → both `CONFLICT`. ✓
- **Rule 3 (admin/organizer resolve):** verified by code audit + `score-submission-audit.spec` (ORGANIZER_REVIEW + ADMIN_OVERRIDE). Live demo pending a startable/conflicted match from the round-41 seed (the only in-progress match was consumed by the Rule-1 test).

## 🐞 Bugs / gaps found
1. **P0 (you fixed live):** `/api/graphql` 500 on every op — `route.ts` called `yoga.handle` (undefined) instead of `yoga.handleRequest`. See round-42. Login + all data were down until restart/fix.
2. **Apply form team dropdown lists ALL teams**, not just teams the viewer captains — the label says "Select a team you captain…" but it offers Da Nang Tigers, Gen Filling Station, etc. that the viewer doesn't captain. Restrict the options to the viewer's captained teams (server already enforces, but the UI shouldn't offer them).
3. **Create-team logo upload is on the Done step, not Basics** — round-35 specified logo upload (with crop) in Step 1 Basics. It currently appears as an optional "add a logo" after creation. Minor deviation; move to Basics or document as intended.
4. **`submitMatchResult` single-captain bypass** (round-41) — still to fix: a captain can complete a match unilaterally via the legacy mutation, skipping two-captain agreement. Lock to organizer/admin.
5. **Data shifts during testing** because the AI is actively re-seeding (round-41) — match IDs changed mid-test. Expected during active dev; just note for stable re-tests.

## Not yet driven live (covered by e2e / prior rounds)
- Competition **creation wizard** (organizer) — covered by `competition-flow.spec`; tested in earlier rounds.
- **Generate matches / start competition** — couldn't start Spring Open (only 2 approved teams vs 4–8 min). Needs a competition seeded right at the start threshold, or approve enough teams.
- **Viewer** read-only — covered by `casl-visibility.spec`.

## Recommendation
Fix #2 (apply team dropdown) and #4 (submitMatchResult bypass); decide on #3 (logo step). Round-41's seed should add a startable competition + a standing CONFLICT match so generate-matches and admin-override can be demoed live.
