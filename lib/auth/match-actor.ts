import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../graphql/context";

/**
 * Round-48 — single source of truth for "who can act on this match as a
 * captain?". A match has two teams; the actor can be:
 *
 *  - Team.captainId for HOME or AWAY (the historical path).
 *  - CompetitionApplication.rosterCaptainUserId for HOME or AWAY (when the
 *    Team Captain wasn't in the playing roster and nominated someone else).
 *  - SUPER_ADMIN (always allowed, returned with role=ADMIN).
 *  - The competition organizer (returned with role=ORGANIZER), so callers
 *    that need a single check can skip a separate organizer lookup.
 *
 * Every captain-side mutation in match.mutations.ts should call this rather
 * than checking `match.homeTeam.captainId === viewer.id` inline — the inline
 * pattern misses Roster Captains.
 */

export type MatchSide = "home" | "away";
export type MatchActorRole = "CAPTAIN" | "ROSTER_CAPTAIN" | "ORGANIZER" | "ADMIN";

export type MatchActor = {
  side: MatchSide | null;
  teamId: string | null;
  role: MatchActorRole;
};

/**
 * Resolve the viewer's match-actor identity. Throws FORBIDDEN if the viewer
 * has no captain-like relationship to the match (and the optional
 * `requireSide` flag is set, which is the default for captain-only flows).
 */
export async function loadMatchActor(
  ctx: GraphQLContext,
  matchId: string,
  opts: { requireSide?: boolean; forbiddenMessage?: string } = {},
): Promise<MatchActor> {
  if (!ctx.viewer) {
    throw new GraphQLError("You must be signed in", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  const viewerId = ctx.viewer.id;
  const isAdmin = ctx.viewer.role === "SUPER_ADMIN";

  const match = await ctx.prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { id: true, captainId: true } },
      awayTeam: { select: { id: true, captainId: true } },
      matchday: {
        select: {
          competitionId: true,
          competition: {
            select: { id: true, organizerId: true },
          },
        },
      },
    },
  });

  const isOrganizer =
    match.matchday.competition.organizerId === viewerId;

  // Team-captain path (the original Round-13 behavior).
  if (match.homeTeam?.captainId === viewerId) {
    return { side: "home", teamId: match.homeTeam.id, role: "CAPTAIN" };
  }
  if (match.awayTeam?.captainId === viewerId) {
    return { side: "away", teamId: match.awayTeam.id, role: "CAPTAIN" };
  }

  // Round-48 Roster Captain path. Find an application in this competition
  // for either of the two teams where the viewer is the nominated roster
  // captain. We cap at one — DB doesn't allow more than one application
  // per (competition, team).
  const rcApp = await ctx.prisma.competitionApplication.findFirst({
    where: {
      competitionId: match.matchday.competition.id,
      rosterCaptainUserId: viewerId,
      teamId: {
        in: [match.homeTeam?.id, match.awayTeam?.id].filter(
          (id): id is string => Boolean(id),
        ),
      },
    },
    select: { teamId: true },
  });
  if (rcApp) {
    const side: MatchSide = rcApp.teamId === match.homeTeam?.id ? "home" : "away";
    return { side, teamId: rcApp.teamId, role: "ROSTER_CAPTAIN" };
  }

  if (isOrganizer) {
    return { side: null, teamId: null, role: "ORGANIZER" };
  }
  if (isAdmin) {
    return { side: null, teamId: null, role: "ADMIN" };
  }

  if (opts.requireSide !== false) {
    throw new GraphQLError(
      opts.forbiddenMessage ??
        "Only a participating captain may take this action",
      { extensions: { code: "FORBIDDEN" } },
    );
  }
  // Shouldn't reach here when requireSide is true; if a caller opts out it
  // returns a "spectator" actor so the caller can branch.
  return { side: null, teamId: null, role: "CAPTAIN" };
}

/**
 * Lighter-weight variant for resolvers that already loaded the match with
 * captain + competition info. Returns the side the viewer can act for via
 * EITHER Team.captainId OR CompetitionApplication.rosterCaptainUserId, or
 * null when the viewer has no captain-like relationship.
 *
 * The caller is responsible for SUPER_ADMIN bypass (preserved by the
 * existing match.mutations.ts pattern).
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

/**
 * Convenience for the lineup-edit approve/reject path which needs the actor
 * to be a captain-like party AND distinct from the original requester.
 */
export function ensureOtherSideCaptain(
  actor: MatchActor,
  requesterUserId: string | null,
  ctxViewerId: string,
) {
  const isAdmin = actor.role === "ADMIN";
  const isCaptainLike =
    actor.role === "CAPTAIN" || actor.role === "ROSTER_CAPTAIN";
  if (isAdmin) return;
  if (!isCaptainLike || ctxViewerId === requesterUserId) {
    throw new GraphQLError(
      "Only the other captain may approve or reject the lineup edit",
      { extensions: { code: "FORBIDDEN" } },
    );
  }
}
