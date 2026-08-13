/**
 * Round-49 — persistent outgoing-email queue.
 *
 * Mutations call `enqueueEmail({ template, to, payload })` instead of
 * sending inline. A worker (Next.js `after()` from inside the same
 * request, or `/api/cron/drain-emails` for retries) calls `drainEmailQueue()`
 * to pull PENDING rows and actually hit SMTP.
 *
 * Why a table instead of in-memory: lets the request return immediately,
 * keeps emails durable across restarts, makes retries trivial, and gives
 * us a paper trail for "did the captain ever get the invite?" questions.
 */

import type { PrismaClient } from "@/lib/generated/prisma/client";
import { sendCompetitionInvite } from "./email.service";

type TemplateName = "competition_invite";

export type EnqueueArgs = {
  template: TemplateName;
  to: string;
  payload: Record<string, unknown>;
};

/**
 * Skip *.local addresses outright — seed users / test fixtures have those,
 * and bouncing real Gmail traffic at them would burn deliverability score
 * without anyone reading the message anyway.
 *
 * Round-75 — also skip *.invalid: shell (unclaimed placeholder) accounts carry
 * synthetic `shell+<id>@placeholder.pooldn.invalid` emails. They must never
 * generate real sends or bounces until a real person claims the profile.
 */
function isTestAddress(to: string): boolean {
  const addr = to.trim().toLowerCase();
  return addr.endsWith(".local") || addr.endsWith(".invalid");
}

export async function enqueueEmail(
  prisma: PrismaClient,
  { template, to, payload }: EnqueueArgs,
): Promise<{ id: string; status: "PENDING" | "SKIPPED" }> {
  if (!to.trim()) {
    throw new Error("enqueueEmail: empty `to` address");
  }
  const skip = isTestAddress(to);
  const row = await prisma.outgoingEmail.create({
    data: {
      template,
      toEmail: to,
      payload: payload as object,
      status: skip ? "SKIPPED" : "PENDING",
      lastError: skip ? "test address (*.local) — not sent" : null,
      sentAt: skip ? new Date() : null,
    },
  });
  return { id: row.id, status: row.status as "PENDING" | "SKIPPED" };
}

/**
 * Drain up to `limit` PENDING rows. Each row's template name resolves to a
 * concrete renderer from email.service.ts. Failures bump `attempts` and
 * land on `lastError`; the next drain call retries them (no exponential
 * backoff yet — add when we see actual transient failures in the wild).
 */
export async function drainEmailQueue(
  prisma: PrismaClient,
  limit = 25,
): Promise<{ sent: number; failed: number }> {
  const rows = await prisma.outgoingEmail.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await dispatch(row.template, row.toEmail, row.payload as Record<string, unknown>);
      await prisma.outgoingEmail.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          attempts: { increment: 1 },
          sentAt: new Date(),
          lastError: null,
        },
      });
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.outgoingEmail.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          lastError: msg.slice(0, 500),
          // Stays PENDING for retry until we hit 5 attempts, then mark
          // FAILED so the next drain skips it.
          status: row.attempts + 1 >= 5 ? "FAILED" : "PENDING",
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}

async function dispatch(
  template: string,
  to: string,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (template) {
    case "competition_invite":
      await sendCompetitionInvite({
        to,
        captainName: String(payload.captainName ?? ""),
        teamName: String(payload.teamName ?? ""),
        competitionName: String(payload.competitionName ?? ""),
        competitionSlug: String(payload.competitionSlug ?? ""),
        organizerName: String(payload.organizerName ?? ""),
        personalNote: payload.personalNote
          ? String(payload.personalNote)
          : null,
      });
      return;
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}
