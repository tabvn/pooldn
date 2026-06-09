# PoolDN — Edit Wizard Review, Team/Player Tabbed Redesign, Admin Edit Team/Player (Round 21)

Four items, grounded in live testing as admin (Toan). Each: Figma-consistent UI (verify via the Figma MCP), CASL, validation, toasts, console-clean, Playwright tests.

## 1. Edit-competition wizard — show info per step so admin can review/check
Today edit reuses the create wizard but it isn't clearly a "review existing data" experience. Improve EDIT mode:
- Title/eyebrow shows **"Edit competition — {name}"** and the primary button reads **"Save changes"** (not Create).
- Each step **clearly displays the current values** (prefilled inputs + a subtle "current value" hint where helpful) so the admin can check as they step through.
- The final **Review step** is a full read-only summary of EVERY step (Basics, Participants, Schedule, Structure blocks + breaks, Rules incl. Break & Run, Prize + distribution) with **edit-jump links** per section — a single "check everything" screen — then Save.
- Reachable for the owner-organizer AND any **SUPER_ADMIN** on any competition (kebab "Edit details" everywhere).
- Test: admin opens edit on another organizer's comp → all current values shown across steps → change a structure block + a date → Save → persists; Review shows the updated summary.

## 2. Team landing page → TABS (redesign)
Today `/teams/[slug]` is one long scroll (Roster → Competitions → Recent matches). Convert to a **tabbed layout** like the competition detail:
- Tabs: **Roster** | **Competitions** | **Matches** | **About**.
  - Roster: members with avatars + role/captain badge.
  - Competitions: the team's competitions (Open/Ongoing/Completed) with status chip + the team's result/standing, linking to each.
  - Matches: recent + full match history with scores and W/L.
  - About: description, captain, home venue/city, created date, team stats.
- Header keeps: team logo, name, captain, member count; actions **Follow / Manage roster (captain/admin) / Edit team (captain/admin) / Request to join (non-member)**.
- Match the Figma team frames; consistent tab styling with the rest of the app.

## 3. Admin edit team + edit player — make it work + test
Admin (SUPER_ADMIN) must be able to fully edit any team and any player (CASL manage-all already grants it; wire the UI + verify the mutations accept a non-owner admin):
- **Edit team**: surface an **"Edit team"** affordance (name, logo upload, description, home city/venue) for the captain AND admin on any team (button/kebab on the team page or manage page). `updateTeam` must allow a SUPER_ADMIN editing a team they don't captain. Confirm + toast.
- **Edit player**: admin can edit any player's profile (name, bio, city, nationality, avatar). The "Edit profile" on `/players/[username]` (which shows for admin) must open a working edit form that updates the TARGET user, not only self. `updateProfile`/a new `adminUpdateUser(userId, ...)` must accept an admin editing another user. Confirm + toast.
- Tests: admin edits another captain's team (name/logo) -> persists; admin edits another player's profile (bio/city) -> persists; a non-owner non-admin is blocked from both.

## 4. Player landing page — redesign (richer + tabbed)
Today `/players/[username]` shows only a header + a bio card. Redesign it like the team/competition pages:
- **Hero header**: avatar (uploaded image), name, @username, nationality flag, city, role badge, joined date; **Edit profile** (self or admin); optional Follow.
- **Tabs**: 
  - **Overview** — career stats: matches played, frames won/played, win %, MVP count/awards; current teams summary; recent form.
  - **Teams** — teams the player is a member/captain of (with logos), linking to each.
  - **Competitions** — competitions the player has played + their result/standing.
  - **Matches** — recent match history (opponent, score, result), deep-linked.
- Public-readable (guest/viewer/any role); private fields (email/phone) hidden; empty states for a brand-new player.
- Deep-linked from every player name/avatar (Players tab, rosters, community, lineups, MVP banner).
- Match the Figma player/profile frame via the Figma MCP.

## Definition of done
Edit wizard is a clear review-and-save experience reachable by admin on any comp; team + player landing pages are tabbed and rich, Figma-matched; admin can edit any team and any player with working forms; all with tests (incl. admin-edits-others), console-clean, green suite.
