"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  AtSign,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Heart,
  Inbox,
  Mail,
  Megaphone,
  MessageCircle,
  Quote,
  Reply,
  Trophy,
  UserPlus,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { NotificationType } from "@/lib/generated/prisma/enums";
import {
  MarkAllNotificationsReadMutation,
  MarkNotificationReadMutation,
  NotificationsConnectionQuery,
  UnreadNotificationCountQuery,
} from "@/lib/graphql/operations/notification.operations";

type Accent = {
  icon: React.ReactNode;
  tone: string;
  border: string;
};

const ACCENT: Record<NotificationType, Accent> = {
  WELCOME: {
    icon: <Bell className="size-4" />,
    tone: "bg-primary/15 text-primary",
    border: "border-l-primary",
  },
  APPLICATION_SUBMITTED: {
    icon: <ClipboardCheck className="size-4" />,
    tone: "bg-info/15 text-info",
    border: "border-l-info",
  },
  APPLICATION_APPROVED: {
    icon: <CheckCircle2 className="size-4" />,
    tone: "bg-success/15 text-success",
    border: "border-l-success",
  },
  APPLICATION_REJECTED: {
    icon: <XCircle className="size-4" />,
    tone: "bg-destructive/15 text-destructive",
    border: "border-l-destructive",
  },
  APPLICATION_WAITLISTED: {
    icon: <Mail className="size-4" />,
    tone: "bg-warning/15 text-warning",
    border: "border-l-warning",
  },
  COMPETITION_STARTED: {
    icon: <Megaphone className="size-4" />,
    tone: "bg-info/15 text-info",
    border: "border-l-info",
  },
  COMPETITION_COMPLETED: {
    icon: <Trophy className="size-4" />,
    tone: "bg-success/15 text-success",
    border: "border-l-success",
  },
  MATCH_SCHEDULED: {
    icon: <Bell className="size-4" />,
    tone: "bg-secondary text-foreground",
    border: "border-l-border",
  },
  MATCH_RESULT_RECORDED: {
    icon: <Trophy className="size-4" />,
    tone: "bg-primary/15 text-primary",
    border: "border-l-primary",
  },
  ROSTER_INVITE: {
    icon: <UserPlus className="size-4" />,
    tone: "bg-info/15 text-info",
    border: "border-l-info",
  },
  COMMUNITY_LIKE: {
    icon: <Heart className="size-4" />,
    tone: "bg-primary/15 text-primary",
    border: "border-l-primary",
  },
  COMMUNITY_COMMENT: {
    icon: <MessageCircle className="size-4" />,
    tone: "bg-info/15 text-info",
    border: "border-l-info",
  },
  COMMUNITY_REPLY: {
    icon: <Reply className="size-4" />,
    tone: "bg-info/15 text-info",
    border: "border-l-info",
  },
  COMMUNITY_MENTION: {
    icon: <AtSign className="size-4" />,
    tone: "bg-primary/15 text-primary",
    border: "border-l-primary",
  },
  COMMUNITY_QUOTE: {
    icon: <Quote className="size-4" />,
    tone: "bg-info/15 text-info",
    border: "border-l-info",
  },
};

const PAGE_SIZE = 20;

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

export function NotificationsInbox() {
  const router = useRouter();
  const toast = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data, loading, fetchMore } = useQuery(NotificationsConnectionQuery, {
    variables: { first: PAGE_SIZE, onlyUnread: false },
    notifyOnNetworkStatusChange: true,
  });
  const [markRead] = useMutation(MarkNotificationReadMutation);
  const [markAll, markAllState] = useMutation(MarkAllNotificationsReadMutation);

  const nodes = data?.notifications?.nodes ?? [];
  const nextCursor = data?.notifications?.nextCursor ?? null;

  // Group by groupKey — same fan-out event shows once with unread count.
  const groups = new Map<string, typeof nodes>();
  for (const n of nodes) {
    const key = n.groupKey ?? n.id;
    const arr = groups.get(key) ?? [];
    arr.push(n);
    groups.set(key, arr);
  }

  function doMarkRead(id: string, isRead: boolean) {
    if (isRead) return;
    markRead({
      variables: { id },
      optimisticResponse: { markNotificationRead: { id, isRead: true } },
      update(cache) {
        // Optimistically drop the unread badge in cache so the bell flips
        // immediately instead of waiting for the next poll/subscription.
        const existing = cache.readQuery({ query: UnreadNotificationCountQuery });
        const cur = existing?.unreadNotificationCount ?? 0;
        cache.writeQuery({
          query: UnreadNotificationCountQuery,
          data: { unreadNotificationCount: Math.max(0, cur - 1) },
        });
      },
    });
  }

  function onClickHead(
    head: (typeof nodes)[number],
    items: typeof nodes,
    groupKey: string,
  ) {
    if (items.length > 1) {
      // Expand inline on first click; navigate on the head's own button only.
      const next = new Set(expanded);
      next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
      setExpanded(next);
      return;
    }
    doMarkRead(head.id, head.isRead);
    if (head.href) router.push(head.href);
  }

  function onClickItem(node: (typeof nodes)[number]) {
    doMarkRead(node.id, node.isRead);
    if (node.href) router.push(node.href);
  }

  async function onMarkAll() {
    const before = nodes.filter((n) => !n.isRead).length;
    await markAll({
      // Zero the badge instantly; on success the server response confirms.
      optimisticResponse: { markAllNotificationsRead: before },
      update(cache) {
        cache.writeQuery({
          query: UnreadNotificationCountQuery,
          data: { unreadNotificationCount: 0 },
        });
        cache.evict({ fieldName: "notifications" });
        cache.gc();
      },
    });
    toast.success(
      before > 0
        ? `Marked ${before} notification${before === 1 ? "" : "s"} as read`
        : "Inbox already clear",
    );
  }

  return (
    <div className="p-8 max-w-3xl space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Everything that affects your competitions, teams, and matches.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          loading={markAllState.loading}
          onClick={onMarkAll}
        >
          Mark all read
        </Button>
      </header>

      {nodes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Inbox className="size-10" />
            <p className="text-sm">No notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {[...groups.entries()].map(([groupKey, items]) => {
            const head = items[0];
            const isExpanded = expanded.has(groupKey);
            const unreadCount = items.filter((n) => !n.isRead).length;
            const accent = ACCENT[head.type];
            return (
              <li key={groupKey}>
                <div
                  className={
                    "rounded-xl border bg-card border-l-4 " +
                    accent.border +
                    " " +
                    (head.isRead && unreadCount === 0
                      ? "border-border opacity-80"
                      : "border-primary/30")
                  }
                >
                  <button
                    type="button"
                    onClick={() => onClickHead(head, items, groupKey)}
                    className="w-full text-left px-4 py-3 hover:bg-secondary/30 transition-colors"
                    data-testid={`notification-${head.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={
                          "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full " +
                          accent.tone
                        }
                      >
                        {accent.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{head.title}</span>
                          {!head.isRead ? (
                            <Badge variant="primary" size="sm">
                              New
                            </Badge>
                          ) : null}
                          {items.length > 1 ? (
                            <Badge variant="neutral" size="sm">
                              +{items.length - 1} more
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {head.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <span title={new Date(head.createdAt).toLocaleString()}>
                            {relativeTime(head.createdAt)}
                          </span>
                          <span className="mx-1.5">·</span>
                          <span className="text-[10px]">
                            {new Date(head.createdAt).toLocaleString()}
                          </span>
                        </p>
                      </div>
                      {items.length > 1 ? (
                        isExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )
                      ) : head.href ? (
                        <span className="text-xs text-muted-foreground">→</span>
                      ) : null}
                    </div>
                  </button>
                  {isExpanded && items.length > 1 ? (
                    <ul className="border-t border-border divide-y divide-border bg-background/40">
                      {items.map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => onClickItem(n)}
                            className="flex w-full items-start gap-3 px-4 py-2 text-left text-sm hover:bg-secondary/40"
                          >
                            <span
                              className={
                                "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full " +
                                accent.tone
                              }
                            >
                              {accent.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{n.title}</span>
                                {!n.isRead ? (
                                  <Badge variant="primary" size="sm">
                                    New
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {n.message}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {relativeTime(n.createdAt)}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            loading={loading}
            onClick={() =>
              fetchMore({
                variables: {
                  first: PAGE_SIZE,
                  after: nextCursor,
                  onlyUnread: false,
                },
                updateQuery: (prev, { fetchMoreResult }) => {
                  if (!fetchMoreResult?.notifications) return prev;
                  return {
                    notifications: {
                      __typename: "NotificationConnection" as const,
                      nodes: [
                        ...(prev.notifications?.nodes ?? []),
                        ...fetchMoreResult.notifications.nodes,
                      ],
                      nextCursor: fetchMoreResult.notifications.nextCursor,
                    },
                  };
                },
              })
            }
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
