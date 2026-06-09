import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runWeeklyDigest } from "@/lib/services/digest.service";
import { pruneSecurityEvents } from "@/lib/services/security-retention.service";

/**
 * Cron endpoint — POST every Sunday 21:00 from your scheduler.
 *
 * Auth: requires a shared secret in the `Authorization: Bearer …` header
 * matching `CRON_SECRET`. Configure both your scheduler and the env var.
 * Without the secret in env, the route is disabled (returns 503) so a
 * misconfigured deploy doesn't accidentally blast emails.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await runWeeklyDigest(prisma);
  // Round-47 — piggyback on the weekly cron for security-event retention
  // so we don't need a second scheduler entry. Best-effort; if it fails
  // the digest run isn't affected.
  let pruned = 0;
  try {
    const r = await pruneSecurityEvents(prisma);
    pruned = r.deleted;
  } catch (e) {
    console.warn("[cron] pruneSecurityEvents failed:", e);
  }
  const sent = results.filter((r) => r.status === "SENT").length;
  const skipped = results.filter((r) => r.status === "SKIPPED_EMPTY").length;
  const failed = results.filter((r) => r.status === "FAILED").length;
  return NextResponse.json({ sent, skipped, failed, pruned, results });
}
