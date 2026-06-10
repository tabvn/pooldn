import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { drainEmailQueue } from "@/lib/services/email-queue.service";

/**
 * Cron — drain the outgoing-email queue.
 *
 * Triggered by an external scheduler every minute or two; serves as the
 * retry path for queued sends that weren't picked up by Next.js after()
 * (server restart between enqueue and drain, SMTP hiccup, etc).
 *
 * Auth mirrors the weekly-digest endpoint: Bearer CRON_SECRET. Without
 * the env var set the route returns 503 so a half-configured deploy
 * can't be used as an open relay trigger.
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
  const { sent, failed } = await drainEmailQueue(prisma);
  return NextResponse.json({ sent, failed });
}
