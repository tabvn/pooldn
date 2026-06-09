# PoolDN — Cancel Completion, Match No-show/Forfeit/Reschedule, Player Withdraw/Leave (Round 20)

Three new features. Build each with CASL permissions, notifications, validation, toasts, confirm dialogs, empty/loading states, Figma-consistent UI, and Playwright coverage.

## 1. Cancel / undo a competition completion
A competition can be marked COMPLETED by mistake (or need reopening). Allow reversing it.
- Mutation `reopenCompetition(id)` (organizer-owner or SUPER_ADMIN): COMPLETED → ONGOING. Clears the frozen winner/MVP (or re-derives on next completion), unfreezes standings, re-enables result entry. Confirm dialog ("This will reopen the competition and clear the final result").
- Distinguish from **Cancel competition** (which sets CANCELLED = the whole event is aborted). Reopen ≠ Cancel. Surface "Reopen competition" in the organizer kebab on a COMPLETED competition.
- Notify participants (competition reopened). Audit who reopened + when.
- Also allow **cancel a CANCELLED back to DRAFT/previous** if needed (admin), but minimum is reopen-from-completed.

## 2. Match no-show → forfeit / walkover / reschedule
A scheduled match sometimes can't be played (team/player sick or absent). Build:
### 2a. Forfeit / walkover (auto-win)
- `forfeitMatch(matchId, forfeitingTeamId, reason)` (organizer-owner/admin; or by mutual report): the **present team auto-wins by walkover**. Record a forfeit result — winner gets the default win (e.g. score = raceToFrames : 0, or a configurable walkover score), match status COMPLETED with a **walkover** flag, and feed standings (count as a win/loss, mark as W/O in the UI). Add `forfeitTeamId` + `isWalkover` (or `winType: NORMAL|WALKOVER|FORFEIT`) on Match.
- If BOTH no-show → double-forfeit / void (no points, or per competition rules).
- "Partner won't play" within a doubles frame: allow the frame/lineup slot to be a walkover too (frame auto-awarded) if a player is absent.
### 2b. Reschedule
- `rescheduleMatch(matchId, newDate, newVenue?, reason)` (organizer-owner/admin) → status POSTPONED then SCHEDULED at the new time; notify both captains.
- **Captain-requested reschedule**: model `MatchRescheduleRequest { matchId, requestedById, proposedDate, reason, status PENDING/APPROVED/REJECTED, reviewedBy/At }`. A captain requests a new time → organizer approves/rejects → on approve, match is rescheduled + both teams notified.
- UI on the match (Match Details / matchday list): organizer sees "Reschedule / Mark forfeit / Mark no-show"; captain sees "Request reschedule". Status chips: Postponed / Walkover / Forfeit.
- Notifications on forfeit, reschedule request, approve/reject, reschedule.

## 3. Player withdraw / leave team (with reason)
- **Withdraw a join request**: `cancelJoinRequest(id)` — the requesting player cancels their own PENDING TeamJoinRequest. UI: "Withdraw request" where they see their pending request.
- **Withdraw a competition application** (captain): `cancelApplication(id)` if not already done — captain withdraws the team's PENDING application before review; re-apply allowed after.
- **Leave team with a reason**: `leaveTeam(teamId, reason)` — a member (NOT the captain) leaves the team; store/notify the captain with the reason. Captain cannot leave (must transfer captaincy or delete the team — add `transferCaptaincy(teamId, newCaptainUserId)` so a captain can hand off then leave). Confirm dialog with an optional reason field.
- Guard: a player on an active competition roster leaving mid-competition — decide policy (block, or allow + flag the roster); at minimum warn the captain. Respect min players per team.
- Notifications: captain notified on leave (with reason) and on join-request withdrawal.

## Schema additions
- Match: `winType (NORMAL|WALKOVER|FORFEIT|DOUBLE_FORFEIT)`, `forfeitTeamId?`, `walkoverReason?`.
- `MatchRescheduleRequest` model (above).
- `TeamMember`: optional `leftAt`, `leaveReason` (or a small audit), `transferCaptaincy` mutation.
- Competition reopen: no schema change (status transition) + audit field if desired.

## Tests
- Reopen: organizer reopens a COMPLETED comp → status ONGOING, winner cleared, results editable; non-owner blocked; admin can.
- Forfeit: mark a scheduled match forfeit → present team wins by walkover, standings update, status shows Walkover; double no-show → void/double-forfeit.
- Reschedule: organizer reschedules → new time + notifications; captain requests reschedule → organizer approves → match moved.
- Leave/withdraw: player withdraws a join request; member leaves with reason (captain notified); captain blocked from leaving without transfer; transferCaptaincy works.

## Definition of done
All three features work start→end with the right roles, notifications, validation, confirm dialogs, and tests; standings/scoreboard reflect walkovers; console-clean; Figma-consistent.
