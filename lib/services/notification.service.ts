import { randomUUID } from "node:crypto";
import type {
  Notification,
  NotificationEntityType,
  NotificationType,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import type { Prisma } from "@/lib/generated/prisma/client";
import { publishNotificationReceived } from "@/lib/graphql/pubsub";
import { isChannelEnabled } from "./notification-preferences";

export type NotificationEntity = {
  type: NotificationEntityType;
  id: string;
  slug?: string | null;
};

export type CreateNotificationArgs = {
  type: NotificationType;
  title: string;
  message: string;
  recipients: string[]; // user ids
  entity?: NotificationEntity;
  groupKey?: string; // shared across one event's fan-out
  metadata?: Prisma.InputJsonValue;
};

/**
 * Centralized notification writer. Every mutation that needs to notify users
 * goes through here so we can:
 *   - guarantee one row per recipient (per-user inbox, no shared rows)
 *   - tag the rows with a shared groupKey for UI collapsing
 *   - emit a realtime event from one place (TODO: GraphQL subscription)
 */
export class NotificationService {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(args: CreateNotificationArgs): Promise<Notification[]> {
    const recipients = Array.from(new Set(args.recipients)).filter(Boolean);
    if (recipients.length === 0) return [];
    // Round-33 — respect per-user preferences on the IN_APP channel. Users
    // who muted this type don't get the row at all. EMAIL is handled by a
    // separate path (digest cron, transactional sends).
    const filtered: string[] = [];
    for (const userId of recipients) {
      const ok = await isChannelEnabled(
        this.prisma,
        userId,
        args.type,
        "IN_APP",
      );
      if (ok) filtered.push(userId);
    }
    if (filtered.length === 0) return [];
    const groupKey = args.groupKey ?? randomUUID();
    const data = filtered.map((userId) => ({
      userId,
      type: args.type,
      title: args.title,
      message: args.message,
      entityType: args.entity?.type ?? null,
      entityId: args.entity?.id ?? null,
      entitySlug: args.entity?.slug ?? null,
      groupKey,
      metadata: args.metadata,
    }));
    await this.prisma.notification.createMany({ data });
    const created = await this.prisma.notification.findMany({
      where: { groupKey, userId: { in: filtered } },
      orderBy: { createdAt: "desc" },
    });
    // Realtime fan-out: ping every recipient through the in-process pubsub
    // so their SSE stream nudges the bell/inbox immediately. Cheap, fire-
    // and-forget; failure here MUST NOT roll back the write.
    for (const n of created) {
      try {
        // GraphQL subscription bus — drives Apollo `notificationReceived`,
        // which is the single realtime channel the bell + inbox listen on.
        publishNotificationReceived(n.userId, n.id, n.type);
      } catch {
        // ignore — realtime is best-effort
      }
    }
    return created;
  }
}

/**
 * Deeplink helper — keep the mapping in one place so the client and any
 * server-side route knows where each notification lands.
 */
export function notificationDeeplink(n: {
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  entitySlug?: string | null;
  metadata?: unknown;
}): string | null {
  if (!n.entityType) return null;
  switch (n.entityType) {
    case "COMPETITION":
      return n.entitySlug ? `/competitions/${n.entitySlug}` : null;
    case "APPLICATION":
      return n.entitySlug
        ? `/competitions/${n.entitySlug}/applications`
        : null;
    case "MATCH":
      return n.entityId ? `/matches/${n.entityId}` : null;
    case "TEAM":
      return n.entitySlug ? `/teams/${n.entitySlug}` : null;
    case "USER":
      return n.entitySlug ? `/profile/${n.entitySlug}` : null;
    case "COMMUNITY_POST": {
      if (!n.entityId) return "/community";
      // Round-A4 — if the notification was emitted from a specific comment
      // (e.g. a reply/mention on a comment), include ?c=<commentId> so the
      // permalink view scroll-highlights it on landing.
      const commentId =
        typeof n.metadata === "object" &&
        n.metadata &&
        "commentId" in (n.metadata as Record<string, unknown>) &&
        typeof (n.metadata as { commentId?: unknown }).commentId === "string"
          ? (n.metadata as { commentId: string }).commentId
          : null;
      return commentId
        ? `/community/${n.entityId}?c=${commentId}`
        : `/community/${n.entityId}`;
    }
    default:
      return null;
  }
}
