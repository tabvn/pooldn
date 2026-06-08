# PoolDN — Notifications Re-test (Round 4)

Re-tested live as **Michael (ORGANIZER)** right after the notifications re-seed. (Note: app was actively Fast-Refresh rebuilding during the test — the AI was mid-edit on shared components — so re-confirm after the build settles + final test run.)

## Works (verified live + in code)
- **Live unread badge on the header bell** (showed "1"). ✓
- Inbox header + **Mark all read** button present. ✓
- Code review of the new stack is strong: typed `NotificationType` enum, per-type icon + tone, `groupKey` grouping, optimistic `markRead` with `optimisticResponse`, `href` deeplink via `notificationDeeplink`, cursor `fetchMore` ("Load more"), `markAll` with `cache.evict`. `NotificationService` centralizes writes. Connection + `unreadNotificationCount` + `markAllNotificationsRead` resolvers all scope to `userId: viewer.id`. Good.

## P1 — Bell count and inbox list disagree
The bell shows **1 unread**, but the inbox renders the empty state ("No notifications yet."). `unreadNotificationCount` returns 1 while `notifications.nodes` comes back empty for the same viewer — they must never disagree.

Both resolvers filter on the same `userId`, so the list should contain that unread row. Likely causes to check:
- The re-seed wrote Michael's unread row but the `notifications` connection (or its nested `NotificationConnection.nodes` re-query by `id in [...]`) returns empty — verify the outer resolver actually returns the ids, and that the double round-trip (resolver `select:{id}` → nested `findMany where id in`) isn't dropping rows.
- A non-null field on a returned node throwing in resolution (e.g. `href`/`notificationDeeplink` on a row with null entitySlug) can null the node and empty the list while the separate count query still succeeds.

Add a regression test: for a seeded user with N unread rows, `unreadNotificationCount === N` AND `notifications.nodes` length ≥ N (first page). They should be derived from the same source of truth.

Also note the redundant nested re-query in `NotificationConnection.nodes` — the resolver already has the page; consider returning full rows once (single query) instead of ids-then-refetch, to avoid the second round-trip per page.

## UI/UX (match Figma quality + polish)
- Group rows: the "+N more" badge and "N unread in this group" line are functional but visually heavy. In the Figma direction, prefer a subtle stacked-card affordance or a count chip on the right, and make the whole group expandable inline rather than navigating on first click.
- Each row should carry a clear type accent (left border or icon-bg tint) using the design tokens (Mist / Primary / Teal / Amber / Sky / Pink) consistently with status chips elsewhere.
- Empty state is fine; add a relative timestamp ("2h ago") in addition to the absolute time, which reads better in a feed.
- Confirm a toast fires on "Mark all read" (you built the shared toast — wire it here).

## Keep going
This is a re-test, not a stop. Fix the count/list mismatch, add the test, then continue the backlog (shared CompetitionCard/MetaChips refactor you started, filters, matchday generation, roster, community) without pausing — matching each new screen to its Figma frame.
