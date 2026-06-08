# PoolDN — Team Captain: Full Capability + Competition Onboarding (Round 13)

What a Team Captain can do, from the Figma (Team Captain Application section, node 356-19451 — read it frame-by-frame via the Figma MCP) + live test as Thomas (Da Nang Tigers). Build/finish every capability below, Figma-matched, validated, permission-gated, tested.

## Captain capability set (the full list)
A team captain can:
1. **Create a team** (`/teams/new`) — exists.
2. **Manage the roster** — exists as DIRECT add/remove only. Must ADD:
   - **Invite a player** (with accept/decline) — missing.
   - **Approve/reject join requests** — missing.
   - Remove member, leave is N/A for captain.
3. **Onboard/join a competition** ("Apply as a Team") — entry exists ("Apply with my team"), but verify the full multi-step flow vs Figma.
4. **Submit match lineups** and **submit match scores** (Match Flow Captain View) — finish per round-9/10.
5. **Follow** competitions/teams.

## TASK A — Roster: invite + join-request (currently direct-add only)
Live: `/teams/[slug]/manage` shows "Current roster" (remove ×) + "Add a player" (search → direct Add). No invite/accept, no join requests.
Build (models from round-12): `TeamInvitation` + `TeamJoinRequest`.
- A.1 **Invite player**: captain searches a user (or enters email) → `inviteToTeam` creates a PENDING invitation + ROSTER_INVITE notification (deeplink to accept). Manage page shows a "Pending invites" list with Cancel.
- A.2 **Accept/decline** (invited player): from the notification/deeplink or a profile "Invitations" area → `respondToInvitation(accept|decline)` → on accept create TeamMember + notify captain.
- A.3 **Request to join** (any player on the team detail page): "Request to join" → `requestToJoinTeam` → PENDING + notify captain.
- A.4 **Approve/reject join request** (captain on manage page): "Join requests" list → `reviewJoinRequest(approve|reject)` → on approve create TeamMember + notify.
- A.5 Validation: can't invite/add an existing member; respect max players per team; can't request a team you're already on. Visible errors, toasts, confirms.

## TASK B — Competition onboarding ("Apply as a Team") — match the Figma flow
Figma (node 356-19451): the captain applies from the competition **Applications tab** via an **"Apply as a Team"** card ("Ready to Compete? / Join with your team"); the flow is multi-step (the section has ~7 frames) ending with the team appearing in **Confirmed Teams** (or pending). Build/verify the multi-step apply flow exactly:
- B.1 Entry: "Apply with my team" / "Apply as a Team" button on the competition (only for captains of an eligible team while OPEN_FOR_APPLICATIONS).
- B.2 Step — **select team** (if the captain has more than one) and **select the roster/lineup** for this competition (choose which of the team's members are on the competition roster; respect min/max players per team).
- B.3 **Roster validation** (round-10): block any player already rostered to another team in THIS competition, with a clear inline error.
- B.4 Optional message to the organizer; **review** the application; **submit**.
- B.5 Confirmation state ("application submitted") + the team shows as PENDING in the competition's Applications tab; organizer is notified; captain can see status and **withdraw/cancel** the application before review, and **re-apply** after rejection.
- B.6 Match the exact layout/spacing/tokens of the Team Captain Application frames via the Figma MCP.

## TASK C — Match Flow (captain): lineup + score (finish per round-9/10)
- C.1 On matchday, captain opens the match → **submit lineup** for the structure's game blocks (Singles/Doubles slots), hidden until both captains submit.
- C.2 After both submit → frames revealed → record per-frame results.
- C.3 **Submit score**; dual-captain auto-approve on match, conflict → organizer review (round-10). Captain sees the submission state.

## TASK D — Tests (captain start→end)
1. Captain create team → invite player → (player accepts) → roster updated.
2. Player requests to join → captain approves → roster updated.
3. Captain applies to an OPEN competition (select roster) → roster validation blocks a shared player → submit → appears PENDING → organizer approves → team in Confirmed/standings.
4. Match: captain submits lineup + score → auto-approve and conflict paths.
5. Authz: captain cannot manage another captain's team or another competition.

## Definition of done
Every captain capability works start→end on the seeded data, matches its Figma frame (verify via MCP), validated + toasted + permission-gated, console-clean, covered by Playwright. Note: the expanded multi-player/team seed (round-12 TASK 5) is needed so these flows have data to test.
