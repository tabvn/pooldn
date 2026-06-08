# PoolDN — Step-by-Step Plan: Full Edit, Team Invites/Joins, Seed, Scoreboard (Round 12)

Grounded in a code audit. For every new screen, pull the matching Figma frame via the Figma MCP (Team Captain Application, Create New Team, Match Flow / Competition Ongoing + Complete for the scoreboard) and match it.

Audit results:
- `MatchFormatBlock` + `breakAndRunRule` exist (structure modeled). ✓
- `updateCompetition` exists but gates edits behind `editableEverything = status === "DRAFT"` — non-draft fields are locked.
- Team mutations: only `createTeam/updateTeam/deleteTeam/addTeamMember/removeTeamMember`. **No invitation or join-request entity/flow** (only a `ROSTER_INVITE` notification type, unused for a real flow).
- `app/(shell)/admin/score-submissions` exists; match-flow has a Scoreboard block.

---

## TASK 0 — CRITICAL: re-match the wizard's Schedule, Structure, and Review steps to Figma (node 166-2613)
The current wizard's middle/end steps do NOT match the Figma. Open the **Competition Creation Flow** frames via the Figma MCP and rebuild these three steps exactly:

0.1 **Schedule step** — the current step is only city + start/end date + prize, which is too thin. The Figma "Schedule" step is real **schedule settings**: scheduling type (fixed / flexible / auto), match days configuration (number of matchdays, dates, start/end times), and venue assignment. Build the full schedule-settings step from the Figma frame, not a 4-field stub. (Prize can stay with it or move per the frame.)

0.2 **Structure step — Break must be a first-class, draggable block type.** Today blocks are Singles/Doubles/Scotch with a "break after (min)" field. The Figma wants the builder to **add BREAK as its own item** in the ordered list alongside Singles and Doubles, and **every item must be drag-to-reorder / sortable** (not just up/down arrows). So the block list is a sortable list of items where each item is one of: Singles block, Doubles block, Scotch block, or **Break** (with a duration). Implement real drag-and-drop sorting (e.g., dnd-kit) for the whole list, with "Add Singles / Add Doubles / Add Break" actions, plus the Break & Run rule. Match the Figma Structure frame.

0.3 **Review & Publish (completion) step** — this step is currently UNREACHABLE (Step 4 "Next" creates directly). Build the real Step 5 from the Figma: a read-only **summary of every step** (Basics, Participants, Schedule, Structure blocks incl. breaks, rules) with edit-jump links, then the **Create draft / Publish** action. The user must reach and see this completion step.

Verify all three against their exact Figma frames via the MCP before moving on.

## TASK 1 — Competition draft edit = full wizard (all steps)
1.1 "Edit details" must open the **same 5-step wizard prefilled** (Basics, Participants, Schedule, **Structure** incl. existing blocks + Break & Run, Review) — not a basics-only form. Reuse `form.tsx` in edit mode (load competition → defaultValues incl. `blocks[]`).
1.2 `updateCompetition` must accept and **replace the ordered `blocks[]`** in a transaction (delete-then-recreate or upsert by order) plus all wizard fields (participants/schedule/prize/rules).
1.3 Edit must include the **Review step** and a **Save / Publish** action (Save keeps DRAFT; Publish if still draft).
1.4 Verify: edit a draft → change a block + min teams + dates → save → re-open edit → all changes persisted.

## TASK 2 — Allow editing everything, even after start (temporary)
2.1 Set `editableEverything = true` in `updateCompetition` (remove the DRAFT-only gate) so all fields incl. structure/participants/schedule are editable in any status. Leave a `// TODO: re-lock post-start fields later` comment and keep the code path so it's a one-line flip back.
2.2 Keep CASL ownership (organizer/admin only) — only the gate on *which fields* by status is removed, not the *who*.
2.3 Surface Edit in the kebab for ONGOING/COMPLETED too (not just DRAFT).
2.4 Verify: edit an ONGOING competition's name/structure/schedule → saves; standings unaffected unless scoring rules change (recompute if points changed).

## TASK 3 — Team creation, invitations, and joining
New models:
```prisma
enum TeamInviteStatus { PENDING ACCEPTED DECLINED CANCELLED EXPIRED }
enum JoinRequestStatus { PENDING APPROVED REJECTED CANCELLED }
model TeamInvitation {
  id        String @id @default(cuid())
  teamId    String
  team      Team   @relation(fields:[teamId],references:[id],onDelete:Cascade)
  invitedUserId String?            // existing user
  email     String?                // or invite by email (not yet registered)
  invitedById String              // captain
  status    TeamInviteStatus @default(PENDING)
  token     String @unique
  createdAt DateTime @default(now())
  respondedAt DateTime?
  @@index([teamId]) @@index([invitedUserId])
}
model TeamJoinRequest {
  id        String @id @default(cuid())
  teamId    String
  team      Team   @relation(fields:[teamId],references:[id],onDelete:Cascade)
  userId    String
  status    JoinRequestStatus @default(PENDING)
  message   String?
  createdAt DateTime @default(now())
  reviewedById String?
  reviewedAt DateTime?
  @@unique([teamId, userId])
}
```
3.1 **Create team** (`/teams/new`): exists — verify against the "Create New Team" Figma frame; on success show "New Team Created" confirmation and route to the team.
3.2 **Invite player** (captain): `inviteToTeam(teamId, userIdOrEmail)` → creates TeamInvitation (PENDING), notifies the invited user (ROSTER_INVITE notification deeplinking to an accept screen). UI on team manage: "Invite player" (search users or enter email) + pending-invites list with Cancel.
3.3 **Accept/decline invitation** (invited player): `respondToInvitation(token|id, accept)` → on accept, create TeamMember + mark ACCEPTED + notify captain. UI: an Invitations section on the player's profile/notifications, or a dedicated accept page from the deeplink.
3.4 **Request to join** (any player → team): `requestToJoinTeam(teamId, message)` → TeamJoinRequest PENDING, notify captain. UI: "Request to join" button on team detail (for non-members).
3.5 **Approve/reject join request** (captain): `reviewJoinRequest(id, approve)` → on approve, create TeamMember + notify; reject notifies. UI: pending join-requests list on team manage.
3.6 **Leave team** (member): `leaveTeam(teamId)` (not the captain) → deactivate membership.
3.7 CASL: captain manages invites/requests for own team; invited/requesting user acts on their own; everyone reads public team rosters.
3.8 All actions: toast + confirm on destructive; visible validation (can't invite an existing member; can't request a team you're already on; respect max players per team).

## TASK 4 — Player account setup + onboarding
4.1 Verify sign-up creates a usable PLAYER account (it exists). After sign-up, route to a light **profile setup** (name, avatar upload, city, nationality) — onboarding step.
4.2 A new player can: browse teams → request to join, or accept an invitation from notifications; appear in a team roster; then be selectable in a competition application + match lineups.
4.3 Verify the deeplinks: ROSTER_INVITE notification → accept screen → joins team.

## TASK 5 — Seed multiple players + teams + memberships + a played competition
Expand `prisma/seed.ts` so the full flow is testable without manual account creation:
5.1 ~12–16 players (PLAYER role) with avatars, across cities.
5.2 ~6–8 teams, each with a captain + 3–5 members (TeamMember rows); include a couple of pending TeamInvitations and TeamJoinRequests for testing those flows.
5.3 One competition per status (DRAFT/OPEN/ONGOING/COMPLETED) with a real **MatchFormatBlock structure** (e.g., 3 singles + 2 doubles, 10-min break).
5.4 For the ONGOING + COMPLETED comps: approved applications, generated matchdays/matches, **MatchFrame rows with player assignments + winners**, MatchParticipant stats, standings, and a few **MatchScoreSubmission** rows (incl. one auto-approved and one CONFLICT awaiting review) so the score-submission + scoreboard screens have data.
5.5 Keep the existing demo one-click logins; add the new players to that list (or a "more players" expander).

## TASK 6 — Scoreboard (ongoing + completion)
6.1 **Ongoing scoreboard** (match in progress): live frame-by-frame view — each game/frame in the structure blocks, current score, who's playing (from lineups), block break indicators, race-to progress. Mirror the Figma Match Flow "Team Match Card" + frames list.
6.2 **Completion scoreboard** (match COMPLETED): final score, per-frame results, MVP/standout, link back to competition standings. Match the "Competition Complete" Figma section.
6.3 Competition-level: the Overview standings already exist; ensure the **ongoing competition** shows live/recent results and the **completed** one shows the winner/MVP banner (already gated to COMPLETED) + final standings + a results archive.
6.4 Wire the scoreboard to the score-submission workflow: show submission status (pending/auto-approved/conflict) on the match.

## TASK 7 — Tests (per role, start→end)
- Captain: create team → invite player → (player accepts) → player in roster → apply to comp (roster validation) → lineup → submit score.
- Player: sign up → setup profile → request to join team → captain approves → appears in roster.
- Invitation: captain invites → invitee accepts/declines → membership reflects it; duplicate/maxed invites rejected with a message.
- Edit: organizer edits an ONGOING competition's structure/schedule → persists.
- Scoreboard: ongoing shows live frames; completed shows final + winner; conflict submission shows "in review".

## Definition of done
Every flow above works start→end across the seeded accounts, Figma-matched (verify each frame via the Figma MCP), validated + toasted + permission-gated, console-clean, and covered by Playwright. Report a per-flow pass/fail list and fix to green.
