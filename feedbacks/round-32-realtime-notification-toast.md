# PoolDN — Realtime notifications must pop a live toast (sonner) (Round 32)

Realtime delivery already exists: `app/api/notifications/stream/route.ts` (SSE) + `lib/notifications/pubsub.ts` + `lib/notifications/use-notification-stream.ts` (the hook fires `onEvent` on each ping) + the bell badge. **Gap:** on a new notification the stream only fires a generic ping that **refetches the unread count** — it does NOT show a toast. Add a live toast.

## Required
1. **Carry the notification content in the realtime event.** Today pubsub publishes a minimal ping (`{userId, notificationId, type}`). Either:
   - include enough to render a toast in the SSE payload (title, message, href/type), OR
   - on ping, the client fetches the newest notification(s) since `lastSeenId` and toasts them.
2. **Pop a toast on each NEW notification, app-wide.** Add a global `<NotificationToaster>` (mounted in the app shell / ApolloWrapper) that subscribes to the stream and, for each genuinely new notification, shows a **toast** (use the existing toast system — sonner-style): the per-type **icon + accent**, the **title** + a short **message**, and a **click action that deep-links** to the entity (reuse the notification `href`). Auto-dismiss after a few seconds; clicking marks it read + navigates.
3. **De-dupe.** Only toast notifications that arrive AFTER the stream connects (track `lastSeenNotificationId`); do NOT re-toast historical/unread ones on connect or on reconnect/refetch. One toast per notification.
4. **Keep the rest working**: the bell badge still increments live, and the `/notifications` inbox still updates (optimistic + refetch). The toast is additive.
5. **Stacking + limits**: multiple rapid notifications stack (cap visible toasts, e.g. 3) and queue; respect reduced-motion.
6. If the app should use the **`sonner`** library specifically (the user referenced it), either adopt sonner as the toaster or make the existing toast behave like it (top/bottom-right, stacked, swipe-dismiss) — match the Figma toast styling.

## Tests
- Trigger a notification for the viewer (e.g., another captain submits an application to your competition) → a toast appears in real time with the right title/icon + deeplink, and the bell badge increments — without a page refresh.
- Reconnecting the stream does NOT re-toast old notifications.
- Clicking the toast marks read + navigates to the entity.
- Rapid notifications stack/queue without overflowing the screen.

## Definition of done
New notifications pop a live sonner-style toast in real time (icon/title/message + deeplink), app-wide, de-duped, alongside the live bell badge + inbox update; Figma-matched; tested.
