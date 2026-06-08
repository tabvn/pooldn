"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { Popover as PopoverPrimitive } from "@base-ui-components/react/popover";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MarkAllNotificationsReadMutation,
  MarkNotificationReadMutation,
  NotificationsConnectionQuery,
  UnreadNotificationCountQuery,
} from "@/lib/graphql/operations/notification.operations";
import { useNotificationStream } from "@/lib/notifications/use-notification-stream";

/**
 * Header bell with a popover preview of recent notifications.
 *
 * Unread badge updates from a count query — polled every 30s AND nudged by
 * the SSE stream (lib/notifications/use-notification-stream) so a new
 * notification refreshes the count in well under a second.
 */
export function NotificationBell({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const { data, refetch } = useQuery(UnreadNotificationCountQuery, {
    skip: !signedIn,
    pollInterval: signedIn ? 30_000 : 0,
    fetchPolicy: "cache-and-network",
  });
  const recent = useQuery(NotificationsConnectionQuery, {
    skip: !signedIn,
    variables: { first: 6 },
    fetchPolicy: "cache-and-network",
  });
  const [markOne] = useMutation(MarkNotificationReadMutation);
  const [markAll, { loading: markingAll }] = useMutation(
    MarkAllNotificationsReadMutation,
  );
  const count = data?.unreadNotificationCount ?? 0;

  // Realtime nudge: the SSE stream pings whenever a notification fires for
  // the viewer; refetch the badge + popover list so the UI reflects state
  // without waiting for the 30s poll.
  useNotificationStream(signedIn, () => {
    refetch();
    recent.refetch();
  });

  const nodes = recent.data?.notifications.nodes ?? [];

  async function onRead(id: string) {
    await markOne({ variables: { id } });
    refetch();
    recent.refetch();
  }
  async function onReadAll() {
    await markAll();
    refetch();
    recent.refetch();
  }

  if (!signedIn) {
    return (
      <Link
        href="/notifications"
        className="relative inline-flex size-9 items-center justify-center rounded-md hover:bg-secondary"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
      </Link>
    );
  }

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        className="relative inline-flex size-9 items-center justify-center rounded-md hover:bg-secondary"
        aria-label={
          count > 0 ? `Notifications (${count} unread)` : "Notifications"
        }
        data-testid="notification-bell"
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
            data-testid="notification-badge"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={8} align="end">
          <PopoverPrimitive.Popup
            className="w-[360px] rounded-xl border border-border bg-card text-card-foreground shadow-xl outline-none"
            data-testid="notification-popover"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Notifications</div>
                <div className="text-xs text-muted-foreground">
                  {count === 0
                    ? "You're all caught up."
                    : `${count} unread`}
                </div>
              </div>
              {count > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={markingAll}
                  onClick={onReadAll}
                >
                  Mark all read
                </Button>
              ) : null}
            </div>
            <ul className="max-h-[60vh] overflow-auto py-1">
              {recent.loading && nodes.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Loading…
                </li>
              ) : nodes.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No notifications yet.
                </li>
              ) : (
                nodes.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.isRead) onRead(n.id);
                        if (n.href) router.push(n.href);
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40 ${
                        n.isRead ? "" : "bg-primary/5"
                      }`}
                      data-testid={`popover-notification-${n.id}`}
                    >
                      <span
                        className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${
                          n.isRead ? "bg-transparent" : "bg-primary"
                        }`}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {n.title}
                        </span>
                        {n.message ? (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {n.message}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </span>
                      {!n.isRead ? (
                        <Check
                          className="mt-1 size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="border-t border-border px-4 py-2 text-right">
              <Link
                href="/notifications"
                className="text-xs font-semibold text-primary hover:underline"
              >
                View all
              </Link>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
