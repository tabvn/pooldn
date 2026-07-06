import { GraphQLError } from "graphql";
import type { PrismaClient } from "@/lib/generated/prisma/client";

// Either the full client or a $transaction client.
type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Assert that none of `playerUserIds` is already rostered on a *different*
 * team in the same competition. "Rostered" means either:
 *  - listed as ApplicationPlayer on a still-live application (PENDING /
 *    WAITLISTED / APPROVED), OR
 *  - written into CompetitionRoster (the locked roster after approval).
 *
 * If any conflict is found, throws a GraphQLError naming player + team.
 */
export async function assertNoCrossTeamRoster(
  tx: Tx,
  competitionId: string,
  teamId: string,
  playerUserIds: string[],
): Promise<void> {
  if (playerUserIds.length === 0) return;

  // 1) Locked roster collisions (cheap, single index hit).
  const lockedConflicts = await tx.competitionRoster.findMany({
    where: {
      competitionId,
      userId: { in: playerUserIds },
      NOT: { teamId },
    },
    include: {
      user: { select: { name: true, username: true } },
      team: { select: { name: true } },
    },
  });
  if (lockedConflicts.length > 0) {
    const c = lockedConflicts[0];
    throw new GraphQLError(
      `${c.user.name} (@${c.user.username}) is already on ${c.team.name} in this competition`,
      {
        extensions: {
          code: "ROSTER_CONFLICT",
          conflicts: lockedConflicts.map((x: typeof lockedConflicts[number]) => ({
            userId: x.userId,
            userName: x.user.name,
            teamId: x.teamId,
            teamName: x.team.name,
          })),
        },
      },
    );
  }

  // 2) Still-live application collisions.
  const liveAppConflicts = await tx.applicationPlayer.findMany({
    where: {
      userId: { in: playerUserIds },
      application: {
        competitionId,
        status: { in: ["PENDING", "WAITLISTED", "APPROVED"] },
        NOT: { teamId },
      },
    },
    include: {
      user: { select: { name: true, username: true } },
      application: { include: { team: { select: { name: true } } } },
    },
  });
  if (liveAppConflicts.length > 0) {
    const c = liveAppConflicts[0];
    const conflictTeamName = c.application.team?.name ?? "another team";
    throw new GraphQLError(
      `${c.user.name} (@${c.user.username}) is already on ${conflictTeamName} for this competition`,
      {
        extensions: {
          code: "ROSTER_CONFLICT",
          conflicts: liveAppConflicts.map((x: typeof liveAppConflicts[number]) => ({
            userId: x.userId,
            userName: x.user.name,
            teamId: x.application.teamId,
            teamName: x.application.team?.name ?? null,
          })),
        },
      },
    );
  }
}

