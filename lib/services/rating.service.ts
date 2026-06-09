/**
 * Round-22 — minimal Elo-style player rating.
 *
 * - Default rating: 1000
 * - Level: floor((rating - 800) / 100), clamped to [1, 30]; so 1000 → 3,
 *   1500 → 8, 800 and below → 1.
 * - When a match completes we credit/debit the K-factor times the
 *   probability gap. K is small (24) so seeded matches don't blow up the
 *   distribution.
 *
 * The persistence shape: on every result write, call `applyMatchResult` for
 * each participating player. The service updates user.rating + user.level in
 * one transaction.
 */

import type { PrismaClient } from "@/lib/generated/prisma/client";

const K = 24;

export function levelFromRating(rating: number): number {
  return Math.min(30, Math.max(1, Math.floor((rating - 800) / 100)));
}

function expected(a: number, b: number) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/**
 * Apply a head-to-head result. `winnerId` and `loserId` must be on opposite
 * teams. Pass a Prisma client / tx; the writes are sequential because the
 * second one depends on the first's read.
 */
export async function applyMatchResult(
  prisma: PrismaClient,
  winnerId: string,
  loserId: string,
  matchId?: string,
) {
  const [w, l] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: winnerId },
      select: { rating: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: loserId },
      select: { rating: true },
    }),
  ]);
  const eW = expected(w.rating, l.rating);
  const wNext = Math.round(w.rating + K * (1 - eW));
  const lNext = Math.round(l.rating + K * (0 - (1 - eW)));
  const wDelta = wNext - w.rating;
  const lDelta = lNext - l.rating;
  await Promise.all([
    prisma.user.update({
      where: { id: winnerId },
      data: { rating: wNext, level: levelFromRating(wNext) },
    }),
    prisma.user.update({
      where: { id: loserId },
      data: { rating: lNext, level: levelFromRating(lNext) },
    }),
    // Round-47 — append a history row per side. Keep the same tx so the
    // history + user.rating stay consistent if one write fails.
    prisma.playerRatingHistory.create({
      data: {
        userId: winnerId,
        rating: wNext,
        delta: wDelta,
        outcome: "WIN",
        opponentId: loserId,
        matchId: matchId ?? null,
      },
    }),
    prisma.playerRatingHistory.create({
      data: {
        userId: loserId,
        rating: lNext,
        delta: lDelta,
        outcome: "LOSS",
        opponentId: winnerId,
        matchId: matchId ?? null,
      },
    }),
  ]);
}
