"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useSubscription } from "@apollo/client/react";
import { toast as sonner } from "sonner";
import {
  CheckCircle2,
  Heart,
  MessageCircle,
  Quote,
  Reply,
  Trophy,
  UserPlus,
  XCircle,
  AtSign,
  Bell,
} from "lucide-react";
import { NotificationReceivedSubscription } from "@/lib/graphql/operations/subscriptions.operations";

/**
 * Round-32 — app-wide live toast on every new notification.
 *
 * Subscribes to `notificationReceived` over SSE and renders a sonner toast
 * with the per-type icon, the title + message, and a click action that
 * deep-links to the notification's entity.
 *
 * De-dupe: we track the highest notification id we've already toasted in a
 * ref. The subscription only delivers events from AFTER it connects, so
 * historical/unread rows aren't replayed; this ref guards the rare case
 * where the server delivers two `next` payloads in fast succession.
 *
 * Renders nothing — side-effect only. Mount once in the app shell.
 */
const ICONS: Record<string, React.ReactNode> = {
  WELCOME: <Bell className="size-4" />,
  APPLICATION_SUBMITTED: <CheckCircle2 className="size-4" />,
  APPLICATION_APPROVED: <CheckCircle2 className="size-4" />,
  APPLICATION_REJECTED: <XCircle className="size-4" />,
  APPLICATION_WAITLISTED: <Bell className="size-4" />,
  COMPETITION_STARTED: <Trophy className="size-4" />,
  COMPETITION_COMPLETED: <Trophy className="size-4" />,
  MATCH_SCHEDULED: <Bell className="size-4" />,
  MATCH_RESULT_RECORDED: <Trophy className="size-4" />,
  ROSTER_INVITE: <UserPlus className="size-4" />,
  COMMUNITY_LIKE: <Heart className="size-4" />,
  COMMUNITY_COMMENT: <MessageCircle className="size-4" />,
  COMMUNITY_REPLY: <Reply className="size-4" />,
  COMMUNITY_MENTION: <AtSign className="size-4" />,
  COMMUNITY_QUOTE: <Quote className="size-4" />,
};

export function NotificationToaster({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const seen = useRef<Set<string>>(new Set());

  useSubscription(NotificationReceivedSubscription, {
    skip: !enabled,
    onData: ({ data: { data } }) => {
      const n = data?.notificationReceived;
      if (!n) return;
      if (seen.current.has(n.id)) return;
      seen.current.add(n.id);
      const icon = ICONS[n.type] ?? <Bell className="size-4" />;
      sonner(n.title, {
        description: n.message,
        icon,
        action: n.href
          ? {
              label: "Open",
              onClick: () => router.push(n.href!),
            }
          : undefined,
        duration: 5_000,
      });
    },
  });

  return null;
}

// Toast container — render once in the app shell. Caps stacked toasts to 3
// and respects the user's reduced-motion preference.
export { Toaster as NotificationToasterContainer } from "sonner";
