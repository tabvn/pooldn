# PoolDN — Full Acceptance Review + Finish-All Plan (Round 11)

Live pass as Organizer (Michael). Captures what's verified, the bugs I found, the features still to finish, and the full role-based acceptance matrix to drive to a production-green state. Use the Figma MCP for any screen still being matched.

## Verified working (do not redo)
- **Dashboard** matches Figma: greeting, Today's Match widget, Upcoming + Active sections with "View all", mobile-app promo.
- **App shell**: sidebar nav icons + active highlight, header country flag, bell, **account dropdown (View profile / Settings / Sign out)**.
- **Create wizard**: 5 steps with lime "Step N · Title" band + "N/5" + progress bar; inline validation; **Step 4 Structure = match builder** (Singles/Doubles/Scotch blocks, games, race-to, break-after-min, reorder, add/remove, running "games total", Break & Run toggle) — exactly to spec; success toast on create.
- **DRAFT competition** kebab: Edit details / Publish – open for applications / Delete draft. **Follow** button present on detail.
- **Venues**: "Add venue" entry point present (CRUD landing).

## BUGS found this pass (fix)
1. **Wizard skips Step 5 (Review & Publish).** On Step 4 Structure, "Next" creates the competition directly — the "5/5 Review" step is never shown. Add the Review step: read-only summary of all steps (Basics, Participants, Schedule, Structure blocks, rules) with Edit-jump links, then **Create draft** / and on the draft, Publish. The progress shows 5 steps but only 4 are reachable.
2. **Slug not auto-derived from name.** Typing the name leaves slug empty (placeholder only) → "At least 3 characters" error on Next. Auto-generate slug from name (editable), so a user isn't forced to hand-type it.
3. **"Today's Match" shows 2:00 AM** — timezone/format bug. Render match times in the competition/venue local timezone (and the user's locale), not raw UTC.
4. **Competition detail flags "1 Issue"** in the dev overlay — a console error/warning on that route. Find and fix (likely a React key/hydration/missing-field warning); the app should be console-clean.
5. **No images yet** on venue/competition/team cards — initials/placeholder only (media upload still landing; see below).

## Features to FINISH + acceptance criteria (in-flight round 8–10)
For each, "done" = built, Figma-matched, validated, toasted, permission-gated, and covered by a test.
- **Media upload**: upload route + `<ImageUpload>`; wired to profile avatar, team logo, competition banner, venue image; images render on all cards/headers (not initials). Accept: upload an image → it appears everywhere that entity shows; bad type/size rejected with a message.
- **Venues CRUD**: `/venues/new` + `/venues/[slug]/edit` + delete; organizer/admin only. Accept: create → appears in list → edit → delete (confirm); non-owner blocked.
- **Competition edit/delete**: "Edit details" opens the wizard prefilled (edit mode) incl. structure blocks; delete only on DRAFT. Accept: edit a draft's blocks → persists; publish locks the right fields.
- **Team edit/delete**: edit name/logo/description; delete (guarded if in active comp). Accept: captain edits own team; non-captain blocked.
- **Profile/Settings**: edit form + avatar upload (self only).
- **Follow**: toggle works (optimistic) AND a **"Following" section on the dashboard** + notifications on followed-entity events. Accept: follow Spring Open → it appears under Following → unfollow removes it.
- **Roster validation** (round-10): a player can't be registered by two teams in one competition — blocked at apply + approve with a clear error; apply form disables already-rostered players.
- **Score submission** (round-10): dual-captain submit → equal = auto-approve (tracked), differ = conflict escalated to organizer/admin who resolves (reviewer tracked); **Score Submissions list** for organizer/admin; standings recompute only on approval.
- **Match Flow lineup** wired to the structure blocks (Singles/Doubles slots from blocks; break time shown; hidden until both captains submit).
- **Competition Pre-Start management**: the Participants/Schedule/Structure config editable from the competition tabs while DRAFT (not only via the wizard), matching the Figma "Competition Pre-Start" frames.

## Full role-based acceptance matrix (implement as Playwright e2e + produce a pass/fail table)
Run each start→end; assert UI renders, data correct, links/buttons valid, mutations toast, destructive actions confirm, authz blocks the disallowed.

**Guest**: `/` → sign-in; protected routes (`/competitions/new`, `/notifications`, `/teams/new`, apply) redirect; public browse read-only; sign-up works.
**Viewer (@viewer)**: dashboard; browse competitions/teams/venues/community read-only; notifications own-only; no create/manage/apply controls; blocked from manager routes.
**Player (@player1)**: dashboard surfaces their comps; Players tab shows their stats; Profile + Settings self-edit; community post; cannot create/approve/record.
**Captain (@thomas/@gen/@hai)**: create/edit/delete own team; roster add/remove; **apply to an OPEN comp incl. roster validation (shared player blocked)**; **Match Flow submit lineup + submit score** (auto-approve when both match; conflict path); follow; cannot manage others' teams/comps.
**Organizer (@michael/@alex)**: create competition (all 5 steps incl. Structure + Review + Publish); edit/delete draft; **cannot see another organizer's draft** (CASL); open apps → approve/reject/waitlist (notify); generate matchdays; resolve **score conflicts**; start → complete (winner only on COMPLETED); cancel (confirm). Venues create/edit.
**Super Admin (@toan)**: sees all incl. all drafts; can manage any entity; admin-only score-submission list across comps; admin affordances gated to SUPER_ADMIN.

**Connectivity**: no orphan screens — every screen reachable in-app and links onward (dashboard ↔ competition ↔ matchdays ↔ match/flow ↔ score submission; teams ↔ team ↔ manage/create; venues ↔ venue ↔ edit; notifications → deeplinks; account → profile/settings).

## Definition of done
All role specs green in Playwright (reuse the running dev server), console-clean on every route, every screen Figma-matched, every mutation validated + toasted + permission-checked. Report a per-role pass/fail matrix and a list of any remaining orphan/broken screens, then fix to 100% green.
