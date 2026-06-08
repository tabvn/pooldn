# PoolDN — Competition Completed + Team Creation/Landing (Round 16)

Read from the Figma "Competition Complete" section and the team frames (verify each via the Figma MCP). The Completed screen largely matches today; the team screens need verification + completion.

## 1. Competition COMPLETED screen
From Figma "Competition Complete" ("Competition / Results"). Status badge **Completed**. Tabs: Overview, Matchdays, Players, About (NO Applications).

1.1 **Overview**:
- **Winner / MVP banner** (purple→teal gradient): Winner = team with its **logo** + "Winner!"; MVP = player with **avatar + nationality flag** + "MVP". Gated to COMPLETED (already correct).
- **Final League Standings**: #, Team (with **logo**), P, W, D, L, PF, PA, PD, Pts; rank highlighting (1st gold/green, relegation red). Final positions frozen.
1.2 **Matchdays**: a **results archive** — every matchday + match with final scores (read-only).
1.3 **Players**: final stat leaderboard (Matches, Frames won/played, Win %, MVP).
1.4 **About**: description, rules, structure, prize distribution (who won what), organizer.
1.5 Derivation: winner = standings position 1; MVP = top player stat (or flagged). Ensure these are computed on completion and persisted (PlayerCompStat.isMvp, standings.position).

Status: implemented version already shows Winner/MVP + standings with avatars — VERIFY it matches the frame (logos in standings, MVP flag, results archive on Matchdays) and fill any gaps. Add the Matchdays results archive + final players leaderboard if missing.

## 2. Team CREATION + Team LANDING page
### 2.1 Create team (`/teams/new`) — match the Figma "Create New Team" frame
- Fields: name (slug auto-derived, editable), **logo upload** (`<ImageUpload>`), description, optional home city/venue.
- Validation (unique name/slug), submit → **"New Team Created"** confirmation → route to the new team; captain auto-set to the creator. Toast on success.

### 2.2 Team landing / detail page (`/teams/[slug]`) — match the Figma team frame
Today (live) it shows: header (name, captain, member count), Follow + Manage roster (captain), and a Roster list with initials. Complete it to the design:
- **Header**: team **logo** (uploaded image, not initials), name, captain, member count, home venue/city; actions: **Follow / Following** (any user), **Manage roster** (captain only), **Request to join** (non-member players), **Edit team** (captain, in a kebab) — and a leave option for members.
- **Roster** section: members with **avatars**, captain badge, role; (captain sees remove + pending invites/join-requests per round-13).
- **Team stats / competitions**: the competitions this team is in (with status), and recent **match history / results**.
- Empty/loading/error states; images render everywhere (logo on the card + header).

### 2.3 Teams list (`/teams`)
Cards with team **logo**, name, captain, member count; "Create team" CTA for captains/eligible users; search/filter if in the design. (Verify the captain landing: navigating to Teams as a captain currently jumps to their own team — confirm that's intended vs showing the list.)

## Tests
- Completed: winner/MVP banner correct; final standings frozen with logos; matchdays show final results; players leaderboard + MVP.
- Create team: create with a logo → confirmation → team page shows the logo; captain auto-set.
- Team landing: captain sees Manage/Edit; non-member sees Request to join; member sees Leave; follow toggles; roster shows avatars; team's competitions + match history render.
- Authz: only the captain manages/edits the team.

## Definition of done
Completed screen matches the Figma "Competition Complete" frame with a results archive; team creation + landing match their frames with images rendering, all actions working with toast/confirm/empty/loading/error states, console-clean, Playwright-covered.
