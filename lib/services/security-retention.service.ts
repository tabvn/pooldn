/**
 * Round-47 — drop old SecurityEvent rows.
 *
 * The table is high-velocity (one row per login attempt, password-reset,
 * rate-limit trip). 90 days of history is plenty for on-call triage; older
 * rows have effectively zero forensic value and grow the index forever.
 *
 * Called from the existing weekly-digest cron so we don't add another
 * scheduled job to operate.
 */
import type { PrismaClient } from "@/lib/generated/prisma/client";

const DEFAULT_DAYS = 90;

export async function pruneSecurityEvents(
  prisma: PrismaClient,
  retentionDays: number = DEFAULT_DAYS,
): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.securityEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return { deleted: result.count };
}
