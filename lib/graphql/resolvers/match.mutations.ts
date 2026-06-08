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
      return ctx.prisma.matchFrame.upsert({
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
    },
  }),

  submitMatchResult: t.prismaField({
    type: "Match",
    description:
      "Captain marks a match COMPLETED with a final score. Triggers standings recomputation.",
    args: { input: t.arg({ type: SubmitMatchResultInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: String(args.input.matchId) },
        include: { matchday: { select: { competitionId: true } } },
      });
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
      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.match.update({
          ...query,
          where: { id: match.id },
          data: {
            status: "COMPLETED",
            homeScore: args.input.homeScore,
            awayScore: args.input.awayScore,
            completedAt: new Date(),
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
}));
