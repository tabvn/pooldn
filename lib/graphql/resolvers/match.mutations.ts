import { GraphQLError } from "graphql";
import { builder } from "../builder";
import {
  RecordFrameInput,
  SubmitLineupInput,
  SubmitMatchResultInput,
} from "../types/match";
import { ensure, requireUser } from "@/lib/casl/guard";
import { recomputeStandings } from "@/lib/services/standings.service";
import { scaffoldMatchFramesFromStructure } from "@/lib/services/match-frame-scaffold";
import { NotificationService } from "@/lib/services/notification.service";
import {
  publishCompetitionStandingsUpdate,
  publishMatchUpdate,
} from "../pubsub";

async function composeDuoLabel(
  tx: import("@/lib/generated/prisma/client").PrismaClient | Parameters<Parameters<import("@/lib/generated/prisma/client").PrismaClient["$transaction"]>[0]>[0],
  slot: { playerId: string | number; partnerPlayerId?: string | number | null | undefined },
): Promise<string> {
  const ids = [String(slot.playerId), String(slot.partnerPlayerId)].filter(
    Boolean,
  ) as string[];
  const users = await tx.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const byId = new Map(users.map((u) => [u.id, u.name]));
  return ids.map((id) => byId.get(id) ?? "?").join(" & ");
}

async function loadMatchForAdmin(
  ctx: import("../context").GraphQLContext,
  matchId: string,
) {
  requireUser(ctx.viewer);
  const match = await ctx.prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      matchday: { select: { competition: { select: { organizerId: true } } } },
    },
  });
  const isOrganizer =
    match.matchday.competition.organizerId === ctx.viewer.id;
  const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
  if (!isOrganizer && !isAdmin) {
    throw new GraphQLError("Only the organizer or admin may edit this match", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return match;
}

builder.mutationFields((t) => ({
  recordMatchFrame: t.prismaField({
    type: "MatchFrame",
    description: "Captain records (or overwrites) the result of a single frame.",
    args: { input: t.arg({ type: RecordFrameInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: String(args.input.matchId) },
      });
      ensure(ctx.ability, "update", {
        ...match,
        __caslSubjectType__: "Match",
      });
      const frame = await ctx.prisma.matchFrame.upsert({
        ...query,
        where: {
          matchId_frameNumber: {
            matchId: match.id,
            frameNumber: args.input.frameNumber,
          },
        },
        update: {
          homeWon: args.input.homeWon,
          homePlayer: args.input.homePlayer ?? null,
          awayPlayer: args.input.awayPlayer ?? null,
        },
        create: {
          matchId: match.id,
          frameNumber: args.input.frameNumber,
          homeWon: args.input.homeWon,
          homePlayer: args.input.homePlayer ?? null,
          awayPlayer: args.input.awayPlayer ?? null,
        },
      });
      // Live: notify everyone watching this match. Standings don't move on
      // a frame change (only on full-match completion), so we don't publish
      // a standings event here.
      publishMatchUpdate(match.id);
      return frame;
    },
  }),

  submitMatchResult: t.prismaField({
    type: "Match",
    description:
      "Organizer or SUPER_ADMIN finalizes a match with a direct score. Captains MUST use submitMatchScore (two-captain agreement); this path is the organizer/admin override.",
    args: { input: t.arg({ type: SubmitMatchResultInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: String(args.input.matchId) },
        include: {
          matchday: {
            select: {
              competitionId: true,
              competition: { select: { organizerId: true } },
            },
          },
        },
      });
      // Round-41 — close the single-captain bypass. Captains can record frames
      // and call submitMatchScore, but only the organizer / SUPER_ADMIN can
      // skip the dual-confirmation flow.
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      const isOrganizer =
        match.matchday.competition.organizerId === ctx.viewer.id;
      if (!isAdmin && !isOrganizer) {
        throw new GraphQLError(
          "Captains must use submitMatchScore — both captains' agreement (or organizer review) is required to finalize a match.",
          { extensions: { code: "FORBIDDEN" } },
        );
      }
      ensure(ctx.ability, "update", {
        ...match,
        __caslSubjectType__: "Match",
      });
      if (match.status === "COMPLETED") {
        throw new GraphQLError("Match already completed", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      const competitionId = match.matchday.competitionId;
      const result = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.match.update({
          ...query,
          where: { id: match.id },
          data: {
            status: "COMPLETED",
            homeScore: args.input.homeScore,
            awayScore: args.input.awayScore,
            completedAt: new Date(),
            completedById: ctx.viewer!.id,
            completionMode:
              ctx.viewer!.role === "SUPER_ADMIN"
                ? "ADMIN_OVERRIDE"
                : "ORGANIZER_REVIEW",
          },
        });
        await recomputeStandings(tx as never, competitionId);
        // Fan-out: notify both captains + organizer in the same txn.
        const full = await tx.match.findUniqueOrThrow({
          where: { id: match.id },
          include: {
            homeTeam: { select: { name: true, captainId: true } },
            awayTeam: { select: { name: true, captainId: true } },
            matchday: {
              select: {
                competition: { select: { id: true, slug: true, organizerId: true } },
              },
            },
          },
        });
        const recipients = [
          full.matchday.competition.organizerId,
          full.homeTeam?.captainId,
          full.awayTeam?.captainId,
        ].filter((id): id is string => !!id);
        await new NotificationService(tx).create({
          type: "MATCH_RESULT_RECORDED",
          title: `Result: ${full.homeTeam?.name ?? "Home"} ${args.input.homeScore} – ${args.input.awayScore} ${full.awayTeam?.name ?? "Away"}`,
          message: "Match result recorded and standings updated.",
          recipients,
          entity: {
            type: "MATCH",
            id: match.id,
            slug: full.matchday.competition.slug,
          },
          groupKey: `match-${match.id}`,
        });
        return updated;
      });
      publishMatchUpdate(match.id);
      publishCompetitionStandingsUpdate(competitionId);
      return result;
    },
  }),

  scaffoldMatchFrames: t.boolean({
    description:
      "Rebuild the match's frame scaffold from the competition structure (idempotent; preserves played frames).",
    args: { matchId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      await loadMatchForAdmin(ctx, String(args.matchId));
      await ctx.prisma.$transaction(async (tx) => {
        await scaffoldMatchFramesFromStructure(tx, String(args.matchId));
      });
      return true;
    },
  }),

  submitLineup: t.prismaField({
    type: "Match",
    description:
      "A captain submits their lineup for a match. The opponent's lineup stays hidden until BOTH sides submit (Round-14 gating).",
    args: { input: t.arg({ type: SubmitLineupInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const matchId = String(args.input.matchId);
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: matchId },
        include: {
          homeTeam: {
            select: {
              id: true,
              captainId: true,
              members: { select: { userId: true } },
            },
          },
          awayTeam: {
            select: {
              id: true,
              captainId: true,
              members: { select: { userId: true } },
            },
          },
          matchday: { select: { competitionId: true, competition: { select: { slug: true } } } },
        },
      });
      let side: "home" | "away" | null = null;
      if (match.homeTeam?.captainId === ctx.viewer.id) side = "home";
      else if (match.awayTeam?.captainId === ctx.viewer.id) side = "away";
      if (!side && ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Only a captain may submit a lineup", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      const teamMembers =
        side === "home"
          ? match.homeTeam?.members ?? []
          : match.awayTeam?.members ?? [];
      const allowedIds = new Set(teamMembers.map((m) => m.userId));
      const seen = new Set<string>();
      for (const slot of args.input.slots) {
        for (const pid of [slot.playerId, slot.partnerPlayerId]) {
          if (!pid) continue;
          const id = String(pid);
          if (!allowedIds.has(id) && ctx.viewer.role !== "SUPER_ADMIN") {
            throw new GraphQLError("Player isn't on this team's roster", {
              extensions: { code: "BAD_USER_INPUT" },
            });
          }
          if (seen.has(id)) {
            throw new GraphQLError("Same player assigned to multiple frames", {
              extensions: { code: "BAD_USER_INPUT" },
            });
          }
          seen.add(id);
        }
      }

      // Block edits once BOTH sides have submitted.
      const otherSideSubmitted =
        (side === "home" ? match.awayLineupSubmittedAt : match.homeLineupSubmittedAt) !== null;
      const ourSideSubmitted =
        (side === "home" ? match.homeLineupSubmittedAt : match.awayLineupSubmittedAt) !== null;
      if (ourSideSubmitted && otherSideSubmitted) {
        throw new GraphQLError("Both lineups are locked", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await scaffoldMatchFramesFromStructure(tx, match.id);
        for (const slot of args.input.slots) {
          await tx.matchFrame.update({
            where: {
              matchId_frameNumber: {
                matchId: match.id,
                frameNumber: slot.frameNumber,
              },
            },
            data:
              side === "home"
                ? {
                    homePlayerId: String(slot.playerId),
                    // For doubles, append partner via the existing free-text
                    // homePlayer field as "Name & Name" (display-only).
                    ...(slot.partnerPlayerId
                      ? { homePlayer: await composeDuoLabel(tx, slot) }
                      : {}),
                  }
                : {
                    awayPlayerId: String(slot.playerId),
                    ...(slot.partnerPlayerId
                      ? { awayPlayer: await composeDuoLabel(tx, slot) }
                      : {}),
                  },
          });
        }
        const tsField =
          side === "home" ? "homeLineupSubmittedAt" : "awayLineupSubmittedAt";
        const idField =
          side === "home" ? "homeLineupSubmittedById" : "awayLineupSubmittedById";
        const updated = await tx.match.update({
          ...query,
          where: { id: match.id },
          data: {
            [tsField]: new Date(),
            [idField]: ctx.viewer!.id,
          } as never,
        });
        // Notify opponent captain (if not yet submitted).
        if (!otherSideSubmitted) {
          const otherCaptain =
            side === "home"
              ? match.awayTeam?.captainId
              : match.homeTeam?.captainId;
          if (otherCaptain) {
            await new NotificationService(tx).create({
              type: "MATCH_SCHEDULED",
              title: "Opponent submitted lineup",
              message: "Submit yours to unlock the match.",
              recipients: [otherCaptain],
              entity: {
                type: "MATCH",
                id: match.id,
                slug: match.matchday.competition.slug,
              },
              groupKey: `lineup-${match.id}`,
            });
          }
        }
        return updated;
      });
    },
  }),

  markFrameWalkover: t.prismaField({
    type: "MatchFrame",
    description:
      "Round-20 — award an individual frame by walkover (e.g. a doubles partner is absent). Captain or organizer/admin only.",
    args: {
      matchId: t.arg.id({ required: true }),
      frameNumber: t.arg.int({ required: true }),
      homeWon: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: String(args.matchId) },
        include: {
          homeTeam: { select: { captainId: true } },
          awayTeam: { select: { captainId: true } },
          matchday: {
            select: { competition: { select: { organizerId: true } } },
          },
        },
      });
      const isOrganizer =
        match.matchday.competition.organizerId === ctx.viewer.id;
      const isCaptain =
        match.homeTeam?.captainId === ctx.viewer.id ||
        match.awayTeam?.captainId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isOrganizer && !isCaptain && !isAdmin) {
        throw new GraphQLError("Only a captain or organizer may mark a walkover", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      return ctx.prisma.matchFrame.upsert({
        ...query,
        where: {
          matchId_frameNumber: {
            matchId: match.id,
            frameNumber: args.frameNumber,
          },
        },
        update: {
          homeWon: args.homeWon,
          isWalkover: true,
        },
        create: {
          matchId: match.id,
          frameNumber: args.frameNumber,
          homeWon: args.homeWon,
          isWalkover: true,
        },
      });
    },
  }),

  forfeitMatch: t.prismaField({
    type: "Match",
    description:
      "Round-20 — record a no-show. The non-forfeiting side wins by walkover (race-to-frames : 0). Pass `bothForfeit: true` for a double no-show.",
    args: {
      matchId: t.arg.id({ required: true }),
      forfeitingTeamId: t.arg.id({ required: true }),
      bothForfeit: t.arg.boolean({ defaultValue: false }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: String(args.matchId) },
        include: {
          homeTeam: { select: { id: true, captainId: true } },
          awayTeam: { select: { id: true, captainId: true } },
          matchday: {
            select: {
              competition: {
                select: {
                  id: true,
                  slug: true,
                  organizerId: true,
                  raceToFrames: true,
                },
              },
            },
          },
        },
      });
      const isOrganizer =
        match.matchday.competition.organizerId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isOrganizer && !isAdmin) {
        throw new GraphQLError("Only the organizer or admin may forfeit a match", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      if (match.status === "COMPLETED") {
        throw new GraphQLError("Match is already completed", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      const forfeitId = String(args.forfeitingTeamId);
      const isHomeForfeit = forfeitId === match.homeTeamId;
      const isAwayForfeit = forfeitId === match.awayTeamId;
      if (!isHomeForfeit && !isAwayForfeit) {
        throw new GraphQLError("forfeitingTeamId is not in this match", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const both = !!args.bothForfeit;
      const race = match.matchday.competition.raceToFrames;
      const winType = both ? "DOUBLE_FORFEIT" : "WALKOVER";
      const home = both ? 0 : isAwayForfeit ? race : 0;
      const away = both ? 0 : isHomeForfeit ? race : 0;
      const compId = match.matchday.competition.id;
      const result = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.match.update({
          ...query,
          where: { id: match.id },
          data: {
            status: "COMPLETED",
            winType: winType as never,
            forfeitTeamId: forfeitId,
            forfeitReason: args.reason ?? null,
            homeScore: home,
            awayScore: away,
            completedAt: new Date(),
            completedById: ctx.viewer!.id,
            completionMode: "FORFEIT",
          },
        });
        const { recomputeStandings } = await import(
          "@/lib/services/standings.service"
        );
        await recomputeStandings(tx as never, match.matchday.competition.id);
        await new NotificationService(tx).create({
          type: "MATCH_RESULT_RECORDED",
          title: both
            ? "Double forfeit recorded"
            : "Match awarded by walkover",
          message: args.reason ?? "The organizer recorded a no-show forfeit.",
          recipients: [
            match.homeTeam?.captainId,
            match.awayTeam?.captainId,
          ].filter((id): id is string => !!id),
          entity: {
            type: "MATCH",
            id: match.id,
            slug: match.matchday.competition.slug,
          },
          groupKey: `forfeit-${match.id}`,
        });
        return updated;
      });
      publishMatchUpdate(match.id);
      publishCompetitionStandingsUpdate(compId);
      return result;
    },
  }),

  requestMatchReschedule: t.prismaField({
    type: "MatchRescheduleRequest",
    description:
      "Round-20 — captain proposes a new date/time; organizer reviews. Multiple PENDING requests per match are allowed.",
    args: {
      matchId: t.arg.id({ required: true }),
      proposedDate: t.arg({ type: "DateTime", required: true }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: String(args.matchId) },
        include: {
          homeTeam: { select: { captainId: true } },
          awayTeam: { select: { captainId: true } },
          matchday: {
            select: {
              competition: {
                select: { id: true, slug: true, organizerId: true },
              },
            },
          },
        },
      });
      const isCaptain =
        match.homeTeam?.captainId === ctx.viewer.id ||
        match.awayTeam?.captainId === ctx.viewer.id;
      if (!isCaptain && ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Only a participating captain may request a reschedule", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      const created = await ctx.prisma.matchRescheduleRequest.create({
        ...query,
        data: {
          matchId: match.id,
          requestedById: ctx.viewer.id,
          proposedDate: args.proposedDate,
          reason: args.reason ?? null,
        },
      });
      await new NotificationService(ctx.prisma).create({
        type: "MATCH_SCHEDULED",
        title: "Reschedule requested",
        message: args.reason ?? "A captain proposed a new match date.",
        recipients: [match.matchday.competition.organizerId],
        entity: {
          type: "MATCH",
          id: match.id,
          slug: match.matchday.competition.slug,
        },
        groupKey: `resched-${created.id}`,
      });
      return created;
    },
  }),

  reviewRescheduleRequest: t.prismaField({
    type: "MatchRescheduleRequest",
    description:
      "Round-20 — organizer approves or rejects a reschedule request. Approval moves the match's scheduledAt.",
    args: {
      id: t.arg.id({ required: true }),
      approve: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const req = await ctx.prisma.matchRescheduleRequest.findUniqueOrThrow({
        where: { id: String(args.id) },
        include: {
          match: {
            include: {
              matchday: {
                select: { competition: { select: { organizerId: true, slug: true } } },
              },
            },
          },
        },
      });
      const isOrganizer =
        req.match.matchday.competition.organizerId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isOrganizer && !isAdmin) {
        throw new GraphQLError("Only the organizer or admin may review", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      if (req.status !== "PENDING") {
        throw new GraphQLError("Already reviewed", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.matchRescheduleRequest.update({
          ...query,
          where: { id: req.id },
          data: {
            status: args.approve ? "APPROVED" : "REJECTED",
            reviewedById: ctx.viewer!.id,
            reviewedAt: new Date(),
          },
        });
        if (args.approve) {
          await tx.match.update({
            where: { id: req.matchId },
            data: { scheduledAt: req.proposedDate },
          });
        }
        await new NotificationService(tx).create({
          type: "MATCH_SCHEDULED",
          title: args.approve
            ? "Reschedule approved"
            : "Reschedule rejected",
          message: args.approve
            ? "The match has been moved to the proposed date."
            : "The organizer declined the proposed date.",
          recipients: [req.requestedById],
          entity: {
            type: "MATCH",
            id: req.matchId,
            slug: req.match.matchday.competition.slug,
          },
          groupKey: `resched-${req.id}`,
        });
        return updated;
      });
    },
  }),

  updateMatchSchedule: t.prismaField({
    type: "Match",
    description: "Organizer reschedules a match (or assigns a venue).",
    args: {
      id: t.arg.id({ required: true }),
      scheduledAt: t.arg({ type: "DateTime" }),
      venueId: t.arg.id(),
    },
    resolve: async (query, _root, args, ctx) => {
      const match = await loadMatchForAdmin(ctx, String(args.id));
      if (match.status === "COMPLETED") {
        throw new GraphQLError(
          "Match already completed — cannot reschedule",
          { extensions: { code: "INVALID_TRANSITION" } },
        );
      }
      return ctx.prisma.match.update({
        ...query,
        where: { id: match.id },
        data: {
          scheduledAt: args.scheduledAt ?? match.scheduledAt,
          venueId: args.venueId ? String(args.venueId) : match.venueId,
        },
      });
    },
  }),

  updateMatchday: t.prismaField({
    type: "Matchday",
    description: "Organizer renames or reschedules a matchday.",
    args: {
      id: t.arg.id({ required: true }),
      label: t.arg.string(),
      scheduledDate: t.arg({ type: "DateTime" }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const md = await ctx.prisma.matchday.findUniqueOrThrow({
        where: { id: String(args.id) },
        include: { competition: { select: { organizerId: true } } },
      });
      const isOrganizer = md.competition.organizerId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isOrganizer && !isAdmin) {
        throw new GraphQLError("Only the organizer or admin may edit", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      return ctx.prisma.matchday.update({
        ...query,
        where: { id: md.id },
        data: {
          label: args.label ?? md.label,
          scheduledDate: args.scheduledDate ?? md.scheduledDate,
        },
      });
    },
  }),

  // Round-47 — lineup edit request: a captain asks the opponent to re-open
  // the lineup. Both sides must have already submitted (lineups locked) and
  // the match must not be in progress or completed.
  requestLineupEdit: t.prismaField({
    type: "Match",
    description:
      "Captain asks the opponent captain to re-open both lineups for editing. Only valid after both lineups are submitted and before the match starts.",
    args: { matchId: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const matchId = String(args.matchId);
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: matchId },
        include: {
          homeTeam: { select: { captainId: true, name: true } },
          awayTeam: { select: { captainId: true, name: true } },
          matchday: { select: { competition: { select: { slug: true } } } },
        },
      });
      const side =
        match.homeTeam?.captainId === ctx.viewer.id
          ? "HOME"
          : match.awayTeam?.captainId === ctx.viewer.id
            ? "AWAY"
            : null;
      if (!side && ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Only a captain may request a lineup edit", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      if (!match.homeLineupSubmittedAt || !match.awayLineupSubmittedAt) {
        throw new GraphQLError("Both lineups must be submitted first", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      if (match.status !== "SCHEDULED") {
        throw new GraphQLError(
          "Lineup edit requests aren't allowed once the match has started",
          { extensions: { code: "INVALID_TRANSITION" } },
        );
      }
      if (match.lineupEditRequestedAt) {
        throw new GraphQLError("A request is already pending", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      const updated = await ctx.prisma.$transaction(async (tx) => {
        const m = await tx.match.update({
          ...query,
          where: { id: match.id },
          data: {
            lineupEditRequestedById: ctx.viewer!.id,
            lineupEditRequestedAt: new Date(),
            lineupEditRequestedSide: side ?? "HOME",
          },
        });
        const otherCaptain =
          side === "HOME"
            ? match.awayTeam?.captainId
            : match.homeTeam?.captainId;
        if (otherCaptain) {
          await new NotificationService(tx).create({
            type: "MATCH_SCHEDULED",
            title: "Opponent requested a lineup edit",
            message: "Approve to re-open both lineups, or reject to keep them locked.",
            recipients: [otherCaptain],
            entity: {
              type: "MATCH",
              id: match.id,
              slug: match.matchday.competition.slug,
            },
            groupKey: `lineup-edit-${match.id}`,
          });
        }
        return m;
      });
      publishMatchUpdate(match.id);
      return updated;
    },
  }),

  approveLineupEdit: t.prismaField({
    type: "Match",
    description:
      "Opponent captain approves a pending lineup-edit request. Clears BOTH lineup-submitted timestamps so both sides can re-edit; player assignments stay so each side only adjusts what changed.",
    args: { matchId: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const matchId = String(args.matchId);
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: matchId },
        include: {
          homeTeam: { select: { captainId: true } },
          awayTeam: { select: { captainId: true } },
          matchday: { select: { competition: { select: { slug: true } } } },
        },
      });
      if (!match.lineupEditRequestedAt) {
        throw new GraphQLError("No pending lineup edit request", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      // Only the OTHER captain (not the requester) can approve.
      const requester = match.lineupEditRequestedById;
      const isOtherCaptain =
        (match.homeTeam?.captainId === ctx.viewer.id ||
          match.awayTeam?.captainId === ctx.viewer.id) &&
        ctx.viewer.id !== requester;
      if (!isOtherCaptain && ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Only the other captain may approve", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      const updated = await ctx.prisma.$transaction(async (tx) => {
        const m = await tx.match.update({
          ...query,
          where: { id: match.id },
          data: {
            homeLineupSubmittedAt: null,
            homeLineupSubmittedById: null,
            awayLineupSubmittedAt: null,
            awayLineupSubmittedById: null,
            lineupEditRequestedAt: null,
            lineupEditRequestedById: null,
            lineupEditRequestedSide: null,
          },
        });
        if (requester) {
          await new NotificationService(tx).create({
            type: "MATCH_SCHEDULED",
            title: "Lineup edit approved",
            message:
              "Both lineups re-opened — submit again when you're ready.",
            recipients: [requester],
            entity: {
              type: "MATCH",
              id: match.id,
              slug: match.matchday.competition.slug,
            },
            groupKey: `lineup-edit-${match.id}`,
          });
        }
        return m;
      });
      publishMatchUpdate(match.id);
      return updated;
    },
  }),

  rejectLineupEdit: t.prismaField({
    type: "Match",
    description:
      "Opponent captain rejects a pending lineup-edit request. Lineups stay locked.",
    args: { matchId: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const matchId = String(args.matchId);
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: matchId },
        include: {
          homeTeam: { select: { captainId: true } },
          awayTeam: { select: { captainId: true } },
          matchday: { select: { competition: { select: { slug: true } } } },
        },
      });
      if (!match.lineupEditRequestedAt) {
        throw new GraphQLError("No pending lineup edit request", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      const requester = match.lineupEditRequestedById;
      const isOtherCaptain =
        (match.homeTeam?.captainId === ctx.viewer.id ||
          match.awayTeam?.captainId === ctx.viewer.id) &&
        ctx.viewer.id !== requester;
      if (!isOtherCaptain && ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Only the other captain may reject", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      const updated = await ctx.prisma.$transaction(async (tx) => {
        const m = await tx.match.update({
          ...query,
          where: { id: match.id },
          data: {
            lineupEditRequestedAt: null,
            lineupEditRequestedById: null,
            lineupEditRequestedSide: null,
          },
        });
        if (requester) {
          await new NotificationService(tx).create({
            type: "MATCH_SCHEDULED",
            title: "Lineup edit rejected",
            message: "Opponent declined the lineup edit request.",
            recipients: [requester],
            entity: {
              type: "MATCH",
              id: match.id,
              slug: match.matchday.competition.slug,
            },
            groupKey: `lineup-edit-${match.id}`,
          });
        }
        return m;
      });
      publishMatchUpdate(match.id);
      return updated;
    },
  }),
}));
