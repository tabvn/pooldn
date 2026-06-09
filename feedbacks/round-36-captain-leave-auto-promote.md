# PoolDN — Captain leaves → auto-promote next member to captain (Round 36)

Today a captain can't leave without `transferCaptaincy` (round-28). Improve: when a captain **leaves**, automatically promote the **first-joined remaining member** (the earliest `TeamMember.joinedAt`, i.e. the first invited/accepted person) to captain — no manual hand-off required.

## Behavior
- `leaveTeam(teamId, reason)` for a **captain**:
  - If there are other active members → set `team.captainId` to the **earliest-joined remaining member** (first invited/accepted), demote the leaver, remove their membership; **notify the new captain** ("You're now the captain of {team}") and the team.
  - If the captain is the **only** member → either block with a friendly message ("You're the last member — delete the team instead") or soft-deactivate/delete the team (decide + document; recommend prompting to delete).
- A normal member leaving is unchanged (just removed + captain notified).
- Keep explicit `transferCaptaincy(teamId, newCaptainUserId)` so a captain can choose a specific successor before leaving; the auto-promote is the fallback when they just leave.

## Edge cases
- "First invited person" = order by `TeamMember.joinedAt` ascending (or by accepted-invitation time); pick the earliest still-active, non-leaving member.
- Run in a transaction (reassign captain + remove membership atomically); recompute any captain-dependent UI.
- Respect min players per team if relevant.

## Tests
- Captain leaves a 3-member team → the earliest-joined remaining member becomes captain (notified); the page reflects the new captain.
- Captain leaves a solo team → blocked with "delete the team instead" (or team is removed) per the chosen policy.
- Explicit transferCaptaincy still works.

## Definition of done
A captain can leave; captaincy auto-transfers to the first-joined remaining member with a notification; the last-member case is handled gracefully; transferCaptaincy still available; tested.
