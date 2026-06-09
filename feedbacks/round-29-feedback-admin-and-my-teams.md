# PoolDN — Admin Feedback Inbox + "My Teams" (Round 29)

## 1. Feedback feature — persist + admin inbox
The `/feedback` form page exists but there is **no `Feedback` model**, so submissions don't persist, and there is **no admin view**. Build the full loop.

### Model
```prisma
enum FeedbackType { BUG FEATURE OTHER }
enum FeedbackStatus { NEW REVIEWING RESOLVED CLOSED }
model Feedback {
  id         String         @id @default(cuid())
  userId     String?                         // null if submitted anonymously/guest
  user       User?          @relation(fields: [userId], references: [id])
  type       FeedbackType   @default(OTHER)
  subject    String
  message    String
  status     FeedbackStatus @default(NEW)
  adminNote  String?
  resolvedById String?
  resolvedBy   User?        @relation("FeedbackResolvedBy", fields: [resolvedById], references: [id])
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
  @@index([status, createdAt(sort: Desc)])
}
```

### Submit
- `createFeedback(type, subject, message)` from the `/feedback` form (signed-in user attaches userId; allow guest with just the text if you support it). On success: thank-you state + toast, and **notify all SUPER_ADMINs** (NotificationService, type e.g. FEEDBACK_RECEIVED, deep-link to the admin feedback detail).

### Admin inbox — `/admin/feedback`
- **Table list** (SUPER_ADMIN only, CASL): columns = **Subject**, **From** (sender avatar + name + @username, or "Guest"), **Type** (chip), **Status** (chip), **Submitted** (relative + absolute date). Newest first, **cursor-paginated** (Load more), filter by status + type, optional search.
- Each row links to a **detail view** (`/admin/feedback/[id]` or a drawer): full subject + message, sender info (link to their player profile), submitted date, and **status management** — change status (New → Reviewing → Resolved/Closed), add an **admin note**, record `resolvedBy`. Toasts on update.
- Add an **"Admin"** entry in the sidebar/account menu for SUPER_ADMIN linking to the admin area (feedback + score-submissions), or surface a feedback count badge.

### Tests
- Submit feedback → persists, admins notified, thank-you shown.
- Admin sees it in the list (correct sender + type + status), opens detail, changes status + note → persists; non-admin is blocked from `/admin/feedback`.
- Pagination + filters work.

## 2. "My Teams" — player can see their teams
Yes, add this. A signed-in player should easily see the teams they belong to or captain.
- Query `myTeams` (teams where viewer is a member or captain), exposing role (captain/member) + logo + member count + current competition.
- Surface it:
  - On the **player profile Teams tab** (round-21) — already planned; make sure it lists the viewer's teams for self-view.
  - And a quick-access **"Your teams"** section: either at the top of the **Teams** page (a "Your teams" band above the public list) or on the **dashboard**. Each links to the team page; captained teams show a "Manage" affordance.
- Ties into invites: when a player **accepts** a `ROSTER_INVITE`, the team appears in My Teams immediately; **leaving** removes it.

### Tests
- A player on 2 teams sees both under My Teams with the right role; a player on none sees an empty state ("You're not on a team yet — find one or create one").
- Accept an invite → team appears in My Teams; leave → it disappears.

## Definition of done
Feedback persists and admins have a paginated inbox with detail + status management + notifications; non-admins blocked; players have a clear "My Teams" view that updates with invites/leaves; tests green; Figma-consistent.
