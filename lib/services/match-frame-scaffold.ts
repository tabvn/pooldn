import type { PrismaClient } from "@/lib/generated/prisma/client";

type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Round-14 — build the per-match MatchFrame scaffold from the competition's
 * ordered MatchFormatBlock list. Each game in a block produces one frame.
 * Frame numbers are assigned in block order. A break between blocks doesn't
 * produce a frame — it shows up only in the UI as a separator.
 *
 * Idempotent: existing recorded frames (homeWon set or players assigned)
 * are preserved. Pending placeholder frames are dropped + rebuilt so that
 * structure edits propagate to unplayed slots without losing finished work.
 */
export async function scaffoldMatchFramesFromStructure(
  tx: Tx,
  matchId: string,
): Promise<number> {
  const match = await tx.match.findUniqueOrThrow({
    where: { id: matchId },
    select: {
      id: true,
      matchday: {
        select: {
          competition: {
            select: {
              id: true,
              blocks: {
                orderBy: { order: "asc" },
                select: { order: true, type: true, games: true },
              },
            },
          },
        },
      },
    },
  });
  const blocks = match.matchday.competition.blocks;
  if (blocks.length === 0) return 0;

  const expected: Array<{
    frameNumber: number;
    blockType: "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES";
    blockOrder: number;
  }> = [];
  let n = 0;
  for (const b of blocks) {
    for (let i = 0; i < b.games; i++) {
      n += 1;
      expected.push({
        frameNumber: n,
        blockType: b.type as "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES",
        blockOrder: b.order,
      });
    }
  }

  const existing = await tx.matchFrame.findMany({
    where: { matchId: match.id },
    orderBy: { frameNumber: "asc" },
  });
  const byNumber = new Map(existing.map((f) => [f.frameNumber, f]));

  // Drop any pending (unrecorded, unassigned) frames beyond the expected count
  // OR with a stale blockType. Played frames stay.
  const toDelete: string[] = [];
  for (const f of existing) {
    const exp = expected.find((e) => e.frameNumber === f.frameNumber);
    const isPlayed =
      f.homeWon !== null || f.homePlayerId || f.awayPlayerId;
    if (!exp && !isPlayed) toDelete.push(f.id);
    if (exp && !isPlayed && exp.blockType !== f.blockType) toDelete.push(f.id);
  }
  if (toDelete.length > 0) {
    await tx.matchFrame.deleteMany({ where: { id: { in: toDelete } } });
  }

  const toCreate = expected
    .filter((e) => {
      const f = byNumber.get(e.frameNumber);
      if (!f) return true;
      // Played frame stays; if we deleted a stale unplayed one above, recreate.
      const isPlayed =
        f.homeWon !== null || f.homePlayerId || f.awayPlayerId;
      return !isPlayed && (toDelete.includes(f.id) || f.blockType !== e.blockType);
    })
    .map((e) => ({
      matchId: match.id,
      frameNumber: e.frameNumber,
      blockType: e.blockType,
      blockOrder: e.blockOrder,
    }));
  if (toCreate.length > 0) {
    await tx.matchFrame.createMany({ data: toCreate, skipDuplicates: true });
  }

  // Round-60 — backfill blockOrder on surviving frames (played frames, and
  // any predating this column) so the per-block flow can group them. Only
  // touches blockOrder; never mutates winners or player assignments.
  for (const e of expected) {
    const f = byNumber.get(e.frameNumber);
    if (f && !toDelete.includes(f.id) && f.blockOrder !== e.blockOrder) {
      await tx.matchFrame.update({
        where: { matchId_frameNumber: { matchId: match.id, frameNumber: e.frameNumber } },
        data: { blockOrder: e.blockOrder },
      });
    }
  }
  return expected.length;
}
