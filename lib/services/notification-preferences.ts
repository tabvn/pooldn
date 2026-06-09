import type {
  NotificationChannel,
  NotificationType,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * In-process cache of (userId, type, channel) → enabled. Cheap because the
 * row count per user is tiny; reading on every notification create avoids a
 * race where prefs change just before a fan-out.
 *
 * The cache is invalidated by the setNotificationPreference mutation.
 */
const CACHE = new Map<string, Map<string, boolean>>(); // userId → typeChannel → enabled

function key(type: NotificationType, channel: NotificationChannel): string {
  return `${type}:${channel}`;
}

export async function isChannelEnabled(
  prisma: PrismaClient | Prisma.TransactionClient,
  userId: string,
  type: NotificationType,
  channel: NotificationChannel,
): Promise<boolean> {
  let row = CACHE.get(userId);
  if (!row) {
    const all = await prisma.notificationPreference.findMany({
      where: { userId },
      select: { type: true, channel: true, isEnabled: true },
    });
    row = new Map(all.map((p) => [key(p.type, p.channel), p.isEnabled]));
    CACHE.set(userId, row);
  }
  const v = row.get(key(type, channel));
  if (v === undefined) {
    // Defaults: in-app and digest are on; transactional emails are off so
    // we don't spam fresh signups before they opt in.
    return channel !== "EMAIL";
  }
  return v;
}

export function invalidatePreferenceCache(userId: string): void {
  CACHE.delete(userId);
}

export async function setPreference(
  prisma: PrismaClient | Prisma.TransactionClient,
  userId: string,
  type: NotificationType,
  channel: NotificationChannel,
  isEnabled: boolean,
): Promise<void> {
  await prisma.notificationPreference.upsert({
    where: { userId_type_channel: { userId, type, channel } },
    create: { userId, type, channel, isEnabled },
    update: { isEnabled },
  });
  invalidatePreferenceCache(userId);
}
