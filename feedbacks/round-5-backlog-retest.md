# PoolDN — Backlog Re-test + Unblock (Round 5)

The AI completed the full backlog and went idle. Re-tested the new work live as Michael (ORGANIZER).

## Verified live
- **Notification bell/list consistency FIXED** — bell shows 1, inbox shows exactly that 1 row. ✓
- Notification row now has the type-accent left border, icon tint, NEW badge, and **both relative ("59m ago") + absolute timestamps**. ✓ (all round-4 UI points)
- **Deeplink works** — clicking the notification opened Spring Open → Applications (pending Gen Filling Station with Approve/Reject, approved Da Nang Tigers, waitlisted Hai's Crew). ✓
- **Community is live** — compose box ("Say something to your league…") + Post + feed, replacing the old "Coming soon". ✓

## Unblock the e2e run (no port change needed)
The AI said it skipped the Playwright suite because the dev server holds port 3000. But `playwright.config.ts` already sets `webServer.reuseExistingServer: !process.env.CI` — so locally Playwright **reuses** the running dev server. Just run `npm run test:e2e`; it will not try to spawn a second server. Run the full suite incl. the 4 new specs (casl-visibility, notifications-consistency, apply-approve-standings, matchday/standings), report pass/fail, fix any reds. (Note: e2e may mutate dev data; re-run `npm run db:seed` after.)

## Minor
- After clicking a notification, the bell badge decremented only on the next poll, not immediately. Have `markRead` optimistically decrement `unreadNotificationCount` in the cache too (you already evict on mark-all).

## Next
After the suite is green: final Figma polish pass on the newly built screens (`/teams/[slug]/manage` roster, `/teams/new`, Community feed, matchday "Generate" empty state) — match frames + tokens, confirm a toast fires on every mutation and a confirm dialog on every destructive action. Then report the final state.
