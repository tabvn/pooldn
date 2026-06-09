import type {
  NotificationType,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import { sendEmail } from "@/lib/email/send";
import { isChannelEnabled } from "./notification-preferences";

/**
 * Round-33 — weekly digest builder.
 *
 * For each active user with notifications from the past week:
 *  1. Collect the rows.
 *  2. Filter out any whose (type, DIGEST) preference is OFF.
 *  3. Group by type, render an HTML email, send.
 *  4. Record a DigestRun so the same week can't double-send.
 *
 * Trigger: POST /api/cron/weekly-digest (route below). Pair with a Vercel
 * Cron / external scheduler hitting it every Sunday at 21:00 local.
 */

function startOfWeek(d: Date): Date {
  const day = d.getUTCDay();
  // Sunday is week-start in our digest cadence (sent Sunday evening).
  const diff = day === 0 ? -7 : -day;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() + diff);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function endOfWeek(start: Date): Date {
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return end;
}

export type DigestSummary = {
  userId: string;
  status: "SENT" | "SKIPPED_EMPTY" | "FAILED";
  itemCount: number;
  failureNote?: string;
};

export async function runWeeklyDigest(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<DigestSummary[]> {
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(weekStart);

  // Pull every active user with an email; mirrors the audience for transactional.
  const users = await prisma.user.findMany({
    where: { isActive: true, email: { not: "" } },
    select: { id: true, name: true, email: true },
  });

  const results: DigestSummary[] = [];
  for (const u of users) {
    // Idempotency — if a row exists for this (user, weekStart), skip.
    const already = await prisma.digestRun.findUnique({
      where: { userId_weekStart: { userId: u.id, weekStart } },
    });
    if (already) continue;

    const notifications = await prisma.notification.findMany({
      where: {
        userId: u.id,
        createdAt: { gte: weekStart, lt: weekEnd },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    // Filter by user's digest preference.
    const filtered: typeof notifications = [];
    for (const n of notifications) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await isChannelEnabled(
        prisma,
        u.id,
        n.type as NotificationType,
        "DIGEST",
      );
      if (ok) filtered.push(n);
    }

    if (filtered.length === 0) {
      await prisma.digestRun.create({
        data: {
          userId: u.id,
          weekStart,
          itemCount: 0,
          status: "SKIPPED_EMPTY",
        },
      });
      results.push({ userId: u.id, status: "SKIPPED_EMPTY", itemCount: 0 });
      continue;
    }

    const html = renderDigestHtml(u.name, filtered);
    const subject = `Your week on PoolDN — ${filtered.length} update${filtered.length === 1 ? "" : "s"}`;
    const res = await sendEmail({ to: u.email, subject, html });
    if (!res.ok) {
      await prisma.digestRun.create({
        data: {
          userId: u.id,
          weekStart,
          itemCount: filtered.length,
          status: "FAILED",
          failureNote: res.error ?? null,
        },
      });
      results.push({
        userId: u.id,
        status: "FAILED",
        itemCount: filtered.length,
        failureNote: res.error,
      });
      continue;
    }
    await prisma.digestRun.create({
      data: {
        userId: u.id,
        weekStart,
        itemCount: filtered.length,
        status: "SENT",
      },
    });
    results.push({ userId: u.id, status: "SENT", itemCount: filtered.length });
  }
  return results;
}

function renderDigestHtml(
  name: string,
  items: Array<{ title: string; message: string; type: string; createdAt: Date }>,
): string {
  const list = items
    .map(
      (n) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;">
          <div style="font-weight:600;color:#111;">${escape(n.title)}</div>
          <div style="font-size:13px;color:#666;">${escape(n.message ?? "")}</div>
          <div style="font-size:11px;color:#aaa;margin-top:2px;">${escape(n.type)}</div>
        </td>
      </tr>`,
    )
    .join("");
  return `
    <div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto;padding:24px;color:#111;">
      <h1 style="font-size:20px;margin:0 0 4px 0;">Hi ${escape(name.split(" ")[0])} —</h1>
      <p style="color:#666;margin:0 0 20px 0;">
        Here's what happened on PoolDN this past week:
      </p>
      <table style="width:100%;border-collapse:collapse;">${list}</table>
      <p style="font-size:11px;color:#aaa;margin-top:24px;">
        You can mute categories from your
        <a href="${escape(appUrl())}/settings/notifications" style="color:#666;">notification settings</a>.
      </p>
    </div>
  `;
}

function escape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function appUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL ?? "https://pooldn.thebaycity.dev";
  return u.replace(/\/+$/, "");
}
