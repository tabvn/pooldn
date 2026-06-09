# PoolDN — P0 Bug: Apply crashes when already applied + Apply-CTA UX (Round 26)

## Bug
`applyToCompetition` (competition.mutations.ts ~405–460) resurrects a CANCELLED/REJECTED application, but if an application already exists with status **PENDING / APPROVED / WAITLISTED**, the code falls through to `tx.competitionApplication.create()` → **Unique constraint failed on (competitionId, teamId)** (the `@@unique([competitionId, teamId])`). A captain re-submitting gets a raw 500.

## Backend fix
In the existing-application branch, after the CANCELLED/REJECTED resurrect case, handle the active case explicitly:
```ts
if (existing && ["PENDING", "APPROVED", "WAITLISTED"].includes(existing.status)) {
  throw new GraphQLError("Your team has already applied to this competition.", {
    extensions: { code: "ALREADY_APPLIED", status: existing.status },
  });
}
```
So it never reaches `create()` for an active application. (Keep the resurrect-on-CANCELLED/REJECTED path.)

## UX fix (the real solution — the captain shouldn't hit this)
On the competition detail, the **"Apply with my team"** CTA must reflect the viewer-team's existing application status for this competition:
- No application → **"Apply with my team"** (enabled).
- PENDING → **"Application pending"** (disabled) + a small "Withdraw" option.
- WAITLISTED → **"Waitlisted"** chip (disabled).
- APPROVED → **"Approved — you're in"** chip (disabled).
- REJECTED or CANCELLED → **"Re-apply"** (enabled; resurrect path).
Query the viewer's captained-team application status for the competition (add a field/query, e.g. `competition.myTeamApplication { status }`) and branch the CTA. Show a toast/error gracefully if the mutation still rejects.

## Tests
- Apply twice (PENDING exists) → friendly ALREADY_APPLIED error, no 500; the CTA shows "Application pending" (disabled).
- Re-apply after REJECTED/CANCELLED → succeeds (resurrects).
- Approved/Waitlisted teams see the correct disabled state.

## Definition of done
No crash on re-apply; the apply CTA always reflects the team's current application status; tests cover all states; console-clean.
