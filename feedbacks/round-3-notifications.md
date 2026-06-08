# PoolDN — Notifications Design (Round 3, senior)

Current state (in code): `Notification` has a free-string `type`, a `metadata` Json that isn't exposed in GraphQL, per-user rows only. Query `notifications(onlyUnread)` returns ALL rows (no pagination). Inbox cards are not clickable (no deeplink), mark-read does a full `refetch`, there's no mark-all-read, no unread count on the bell, no realtime. This is the area to make best-practice.

## 1. Typed notifications + entity reference (deeplink)
Promote `type` to a Prisma enum and add a structured entity reference instead of relying on loose Json:

```prisma
enum NotificationType {
  APPLICATION_SUBMITTED
  APPLICATION_APPROVED
  APPLICATION_REJECTED
  APPLICATION_WAITLISTED
  COMPETITION_STARTED
  COMPETITION_COMPLETED
  MATCH_SCHEDULED
  MATCH_RESULT_RECORDED
  ROSTER_INVITE
}
enum NotificationEntity { COMPETITION APPLICATION MATCH TEAM }

model Notification {
  // ...
  type       NotificationType
  entityType NotificationEntity?
  entityId   String?
  entitySlug String?            // denormalized so the deeplink needs no extra query
  groupKey   String?            // for UI grouping (e.g. competitionId)
  @@index([userId, isRead, createdAt(sort: Desc)])
  @@index([entityType, entityId])
}
```

Expose `type`, `entityType`, `entityId`, `entitySlug`, `groupKey` in the GraphQL type. Derive the deeplink in one place: COMPETITION → `/competitions/{entitySlug}`, APPLICATION → `/competitions/{entitySlug}/applications`, MATCH → `/matches/{entityId}`, TEAM → `/teams/{entitySlug}`. Each row in the inbox becomes a `<Link>`; clicking marks it read (optimistic) and navigates. Map each `type` to an icon + accent token from the Figma palette.

## 2. loadMore (cursor pagination)
Convert `notifications` to a Pothos `prismaConnection` (cursor on `createdAt,id`). Inbox uses `fetchMore` with a "Load more" button or infinite scroll. Same pagination pattern we want on competition/team lists — keep it consistent. Page size ~20, lean on `@@index([userId, isRead, createdAt desc])`.

## 3. Realtime + unread badge
- Add `unreadNotificationCount` query and show a count badge on the header bell.
- Interim realtime: Apollo `pollInterval` (~30s) on the unread-count query + refetch the first page on focus.
- Proper realtime: emit an event on every notification write (Postgres `LISTEN/NOTIFY` or an in-process pub/sub) and expose a GraphQL subscription `notificationAdded` over WS. Design the write path now (single `createNotification` service that emits) so the subscription layers on without refactoring.
- Mark-read should be **optimistic** (update cache, no full `refetch`); add `markAllRead`.

## 4. Group-entity support (best practice)
Two distinct needs — do both:

a) **Audience = a group, not just one user.** Events like "match scheduled" or "competition started" target a team or all participants, not one userId. Use **fan-out-on-write**: a single `createNotification(type, entity, recipients[])` service resolves recipients (e.g. all members of a team, the organizer + both captains of a match) and inserts one per-user row sharing the same `groupKey`/`entityId`. Fan-out-on-write keeps the read path and the existing per-user index simple and fast vs. join-at-read.

b) **UI grouping by entity.** In the inbox, collapse rows that share `groupKey` into a single group ("3 updates on Spring Open", expandable), newest first, unread count per group. The `groupKey`/`entityId` from (1) drives this.

## 5. Write-path centralization
All current ad-hoc notification inserts (application approve/reject, match result, lifecycle transitions) must route through one `NotificationService.create(...)` that sets `type`, entity ref, recipients, and emits the realtime event. No inline `prisma.notification.create` scattered in mutations. Add a test per event type asserting the right recipients + type + deeplink target.

## Acceptance
- Bell shows live unread count; inbox paginates; each notification deeplinks to its entity and marks read optimistically; mark-all-read works.
- A team-targeted event creates one row per member with a shared groupKey; inbox groups them.
- Tests: recipients/type/deeplink per event; pagination; authz (a user only ever sees their own rows).
