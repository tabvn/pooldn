import type { GraphQLContext } from "../graphql/context";

/**
 * Round-48 — single source of truth for "which side can the viewer act for
 * as a captain?". A match has two teams; the actor can be:
 *
 *  - Team.captainId for HOME or AWAY (the historical path).
 *  - CompetitionApplication.rosterCaptainUserId for HOME or AWAY (when the
 *    Team Captain wasn't in the playing roster and nominated someone else).
 *
 * Every captain-side mutation in match.mutations.ts should resolve the side
 * through this rather than checking `match.homeTeam.captainId === viewer.id`
 * inline — the inline pattern misses Roster Captains. (SUPER_ADMIN bypass is
 * handled by the caller, per the existing match.mutations.ts pattern.)
 */

export type MatchSide = "home" | "away";

/**
 * Returns the side the viewer can act for via EITHER Team.captainId OR
 * CompetitionApplication.rosterCaptainUserId, or null when the viewer has no
 * captain-like relationship to the match.
 */
export async function findCaptainSide(
  ctx: GraphQLContext,
  match: {
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeTeam: { captainId: string } | null;
    awayTeam: { captainId: string } | null;
    matchday: { competition: { id: string } };
  },
  viewerId: string,
): Promise<MatchSide | null> {
  if (match.homeTeam?.captainId === viewerId) return "home";
  if (match.awayTeam?.captainId === viewerId) return "away";
  const teamIds = [match.homeTeamId, match.awayTeamId].filter(
    (id): id is string => Boolean(id),
  );
  if (!teamIds.length) return null;
  const rcApp = await ctx.prisma.competitionApplication.findFirst({
    where: {
      competitionId: match.matchday.competition.id,
      rosterCaptainUserId: viewerId,
      teamId: { in: teamIds },
    },
    select: { teamId: true },
  });
  if (!rcApp) return null;
  return rcApp.teamId === match.homeTeamId ? "home" : "away";
}
