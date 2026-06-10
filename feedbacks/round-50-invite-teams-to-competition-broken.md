# PoolDN — P0: "Invite teams to competition" is broken (stale Prisma client) (Round 50)

## Symptom (reproduced live as organizer michael)
`inviteTeamsToCompetition(competitionId, teamIds)` fails with **`Unexpected error` / `INTERNAL_SERVER_ERROR`**. The organizer cannot invite any team to a competition; no INVITED applications are created, no notification/email goes out, and the captain never sees an invite to accept/decline.

## Root cause
Server stack:
```
TypeError: Cannot read properties of undefined (reading 'create')
  at enqueueEmail (lib/services/email-queue.service.ts:42)
  at inviteTeamsToCompetition resolver
```
`enqueueEmail` calls `prisma.outgoingEmail.create(...)`, but **`prisma.outgoingEmail` is `undefined`**. The `OutgoingEmail` model exists in `prisma/schema.prisma` (line ~1178, `@@map("outgoing_emails")`) and a migration exists (`20260610170000_round49_email_queue`), but the **generated Prisma client was not regenerated** (no `outgoingEmail` delegate in `lib/generated/prisma`), so at runtime the delegate is undefined.

## Fix
1. **Regenerate + apply on the host** (I can't reach the dev DB/client from the sandbox):
   ```
   npx prisma migrate deploy   # ensure the outgoing_emails table exists
   npx prisma generate         # regenerate the client so prisma.outgoingEmail exists
   ```
   then **restart the dev server** so it loads the fresh client. (When you add a Prisma model, the client must be regenerated and the dev server restarted — otherwise every call to the new delegate throws this exact error.)
2. **Robustness (do this too):** a mail-queue hiccup should NOT break the core invite. Wrap the `enqueueEmail` call in the invite resolver in try/catch (log + continue), so the INVITED applications + in-app notifications still succeed even if email enqueue fails. The invite's primary effect (creating INVITED rows + notifying the team) shouldn't depend on the email side.

## Verify after fix
- As organizer: `inviteTeamsToCompetition(comp, [teamA, teamB])` returns INVITED applications (no error).
- The invited team's captain sees the invite banner on the competition page (`competition-invite-actions.tsx`): **Accept invite** (→ `/competitions/{slug}/apply?teamId=`) flips INVITED→PENDING; **Decline** (`withdrawApplication`) removes it. (These accept/deny paths couldn't be tested yet because the invite itself crashes.)
- Add an e2e: organizer invites → captain accepts (PENDING) / declines (withdrawn).

## Definition of done
`inviteTeamsToCompetition` works (client regenerated + table migrated + server restarted); email enqueue failures are non-fatal to the invite; captain Accept/Decline verified end-to-end; e2e covers it.
