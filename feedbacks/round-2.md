# PoolDN — Senior Review (Round 2)

Re-test after round-1 fixes. Reviewer stance: senior full-stack — correctness, DB performance, authorization, reusability, and Figma-exact UI/UX.

## Verified fixed (good work)
- Winner/MVP banner now gated on COMPLETED (ONGOING comp clean; COMPLETED shows winner + MVP). ✓
- Standings: approved-only teams + team avatars; rejected team gone. ✓
- Competition header: status badge, `format · gameType` chip, and icon-chips for date / location / team count / prize. ✓ Matches Figma.
- Organizer actions collapsed into a `⋯` kebab menu. ✓
- Create form: styled `Select` for Game type / Format / Type / City; native date inputs themed dark (`color-scheme: dark`, lime picker icon). ✓
- Drafts hidden from guests/players. ✓
- 103/103 tests green.

## P1 — Authorization leak (new, confirmed in code)
`lib/casl/ability.ts`, `ORGANIZER` branch has an **unconditional** rule:

```ts
can("read", "Competition");            // ← leaks every competition to any organizer
can("manage", "Competition", { organizerId: actor.id });
```

Effect: logged in as **Michael (ORGANIZER)** I see **Alex's** `toronto-bayside-cup-2027` DRAFT and the `e2e` DRAFT leagues on Poolhub. An organizer must see published comps (the guest baseline already grants that) **plus only their own** at any status.

Fix:
```ts
// remove the blanket read; scope to ownership
can("read", "Competition", { organizerId: actor.id });
```
Add a regression test: organizer A must NOT see organizer B's DRAFT in the `competitions` query. This is also a reminder: **all visibility must live in CASL `accessibleBy`, never in the page/UI** — every new list query needs per-role tests.

Also: purge the leftover `e2e-*` test-league rows from the dev seed so the public feed is clean.

## Architecture notes (keep / raise the bar)
Already solid: Pothos `prismaField` (`...query`) avoids N+1; CASL `accessibleBy` on every query; services layer; standings recompute is approved-only and idempotent. Keep these patterns. Going forward:

1. **Pagination**: `competitions` and other list queries return all rows. Move to `prismaConnection` (cursor pagination) before data grows; lean on the existing `@@index([status, startDate])`.
2. **Transactions**: matchday auto-generation should bulk `createMany` inside one `$transaction`, not per-match awaits. Confirm `recomputeStandings` runs in the same tx as match completion (the comment says it should — make it so and test it).
3. **Reusability**: you now have `icon-chip`, `Avatar`, `Select`, `dropdown-menu`. Extract the Poolhub card and the detail-header meta into shared `<CompetitionCard>` and `<MetaChips>` so the deferred screens reuse them instead of re-implementing.

## UI/UX — Figma-exact for remaining work
For every remaining flow (Match Flow Captain View, Onboarding, Community, profile, filters), open the matching Figma frame and match spacing, type scale, and the design's color tokens (Mist / Primary / Teal / Amber / Sky / Pink). Every mutation should surface a toast, and destructive actions (Cancel / Complete) a confirm dialog.

## Apply flow — prove it end-to-end
form.tsx compiles now. Add an e2e that, as a team captain, submits an application → organizer approves → after a completed match the team appears in standings. Don't just unit-test the form; exercise the real flow.

## Directive to the implementer
Continue through the deferred backlog (profile, filters, matchday generation, roster, community) **without pausing for confirmation between features**. Apply the senior bar above to each. Report back only when the full set is implemented, Figma-matched, and tests are green.
