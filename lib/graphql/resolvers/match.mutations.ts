import { GraphQLError } from "graphql";
import { builder } from "../builder";
import {
  RecordFrameInput,
  SubmitLineupInput,
  SubmitMatchResultInput,
} from "../types/match";
import { ensure, requireUser } from "@/lib/casl/guard";
import { findCaptainSide } from "@/lib/auth/match-actor";
import {
  recomputeMvp,
  recomputeStandings,
} from "@/lib/services/standings.service";
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

// Round-60 — a block is "published" once BOTH sides have submitted their
// lineup for it; only then can its frames' winners be recorded.
async function blockIsPublished(
  tx: import("@/lib/generated/prisma/client").PrismaClient | Parameters<Parameters<import("@/lib/generated/prisma/client").PrismaClient["$transaction"]>[0]>[0],
  matchId: string,
  blockOrder: number,
): Promise<boolean> {
  const rows = await tx.matchBlockLineup.findMany({
    where: { matchId, blockOrder },
    select: { side: true },
  });
  const sides = new Set(rows.map((r) => r.side));
  return sides.has("HOME") && sides.has("AWAY");
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
        include: {
          homeTeam: { select: { captainId: true } },
          awayTeam: { select: { captainId: true } },
          matchday: {
            select: { competition: { select: { id: true, organizerId: true } } },
          },
        },
      });
      // Round-60 — authorize a frame winner the same way as the lineup +
      // walkover paths: Team Captain / per-comp Roster Captain, organizer, or
      // admin. (CASL's relation conditions can't match against an unpopulated
      // match row, which is why this uses the explicit helper.)
      const isOrganizer =
        match.matchday.competition.organizerId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      const isCaptain =
        (await findCaptainSide(ctx, match, ctx.viewer.id)) !== null;
      if (!isOrganizer && !isCaptain && !isAdmin) {
        throw new GraphQLError("Only a captain or organizer may record a frame", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      // Round-60 — a frame's winner can only be set once its block's lineup is
      // published (both captains submitted). Skip for legacy/INDIVIDUAL frames
      // that have no blockOrder.
      const targetFrame = await ctx.prisma.matchFrame.findUnique({
        where: {
          matchId_frameNumber: {
            matchId: match.id,
            frameNumber: args.input.frameNumber,
          },
        },
        select: { blockOrder: true },
      });
      if (targetFrame?.blockOrder != null) {
        const published = await blockIsPublished(
          ctx.prisma,
          match.id,
          targetFrame.blockOrder,
        );
        if (!published) {
          throw new GraphQLError("This block's lineup isn't published yet", {
            extensions: { code: "INVALID_TRANSITION" },
          });
        }
      }
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
          breakAndRun: args.input.breakAndRun ?? false,
        },
        create: {
          matchId: match.id,
          frameNumber: args.input.frameNumber,
          homeWon: args.input.homeWon,
          homePlayer: args.input.homePlayer ?? null,
          awayPlayer: args.input.awayPlayer ?? null,
          breakAndRun: args.input.breakAndRun ?? false,
        },
      });
      // Round-60 — first recorded frame flips the match to IN_PROGRESS so the
      // scoreboard reads "In Progress" (matches Figma). Completion still only
      // happens via the dual-captain score submission.
      if (match.status === "SCHEDULED") {
        await ctx.prisma.match.update({
          where: { id: match.id },
          data: { status: "IN_PROGRESS", startedAt: match.startedAt ?? new Date() },
        });
      }
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
        await recomputeMvp(tx as never, competitionId);
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
      "Round-60 — a captain submits their lineup for ONE block. Blocks are played in order: a block's frames unlock for winner entry once BOTH sides submit it; the next block can only be submitted after the previous block is fully decided. A side may freely re-submit its own block until the opponent submits the same block.",
    args: { input: t.arg({ type: SubmitLineupInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const matchId = String(args.input.matchId);
      const blockOrder = args.input.blockOrder;
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
          matchday: { select: { competitionId: true, competition: { select: { id: true, slug: true } } } },
        },
      });
      if (match.status === "COMPLETED") {
        throw new GraphQLError("This match is already complete", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      // Round-48 — accept Team Captain OR per-competition Roster Captain.
      const side = await findCaptainSide(ctx, match, ctx.viewer.id);
      if (!side && ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Only a captain may submit a lineup", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      const sideUpper: "HOME" | "AWAY" = side === "home" ? "HOME" : "AWAY";
      // Lineups are limited to the roster the team locked in when it applied
      // to THIS competition, not the full team membership. Fall back to team
      // members only when no competition roster was captured (legacy data).
      const teamId = side === "home" ? match.homeTeam?.id : match.awayTeam?.id;
      const compRoster = teamId
        ? await ctx.prisma.competitionRoster.findMany({
            where: { competitionId: match.matchday.competitionId, teamId },
            select: { userId: true },
          })
        : [];
      const teamMembers =
        side === "home"
          ? match.homeTeam?.members ?? []
          : match.awayTeam?.members ?? [];
      const allowedIds = new Set(
        compRoster.length > 0
          ? compRoster.map((r) => r.userId)
          : teamMembers.map((m) => m.userId),
      );
      for (const slot of args.input.slots) {
        for (const pid of [slot.playerId, slot.partnerPlayerId]) {
          if (!pid) continue;
          const id = String(pid);
          if (!allowedIds.has(id) && ctx.viewer.role !== "SUPER_ADMIN") {
            throw new GraphQLError("Player isn't on this team's competition roster", {
              extensions: { code: "BAD_USER_INPUT" },
            });
          }
        }
        if (
          slot.partnerPlayerId &&
          String(slot.playerId) === String(slot.partnerPlayerId)
        ) {
          throw new GraphQLError(
            "A doubles couple can't be the same player",
            { extensions: { code: "BAD_USER_INPUT" } },
          );
        }
      }

      // Round-60 — once BOTH sides have submitted THIS block it's locked
      // (re-open via the edit-request flow). A side may still re-submit its
      // own block while the opponent hasn't.
      const blockRows = await ctx.prisma.matchBlockLineup.findMany({
        where: { matchId: match.id, blockOrder },
        select: { side: true },
      });
      const existingSides = new Set(blockRows.map((r) => r.side));
      if (existingSides.has("HOME") && existingSides.has("AWAY")) {
        throw new GraphQLError("This block's lineup is locked", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      const otherSideSubmitted = existingSides.has(
        sideUpper === "HOME" ? "AWAY" : "HOME",
      );

      const result = await ctx.prisma.$transaction(async (tx) => {
        await scaffoldMatchFramesFromStructure(tx, match.id);
        const frames = await tx.matchFrame.findMany({
          where: { matchId: match.id },
          select: {
            frameNumber: true,
            blockType: true,
            blockOrder: true,
            homeWon: true,
            homePlayerId: true,
            awayPlayerId: true,
          },
        });
        const blockFrames = frames.filter((f) => f.blockOrder === blockOrder);
        if (blockFrames.length === 0) {
          throw new GraphQLError("No such block in this match", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        const blockFrameNumbers = new Set(blockFrames.map((f) => f.frameNumber));

        // (a) Sequential gate — every earlier block must be fully decided.
        const earlierUndecided = frames.some(
          (f) =>
            f.blockOrder != null &&
            f.blockOrder < blockOrder &&
            f.homeWon === null,
        );
        if (earlierUndecided) {
          throw new GraphQLError(
            "Finish the previous block before submitting this one",
            { extensions: { code: "INVALID_TRANSITION" } },
          );
        }

        // (b) Slots must belong to this block.
        for (const slot of args.input.slots) {
          if (!blockFrameNumbers.has(slot.frameNumber)) {
            throw new GraphQLError(
              "Lineup slot doesn't belong to this block",
              { extensions: { code: "BAD_USER_INPUT" } },
            );
          }
        }

        // (c) Captains may assign any roster player to any games — there's no
        // cap on how many singles/doubles a player appears in. The only guard
        // is that a doubles couple can't be the same person twice (a slip, not
        // a valid lineup).
        for (const slot of args.input.slots) {
          if (
            slot.partnerPlayerId &&
            String(slot.partnerPlayerId) === String(slot.playerId)
          ) {
            throw new GraphQLError(
              "A doubles couple needs two different players",
              { extensions: { code: "BAD_USER_INPUT" } },
            );
          }
        }

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

        // Upsert this side's per-block submission (re-submit refreshes it).
        await tx.matchBlockLineup.upsert({
          where: {
            matchId_side_blockOrder: {
              matchId: match.id,
              side: sideUpper,
              blockOrder,
            },
          },
          create: {
            matchId: match.id,
            side: sideUpper,
            blockOrder,
            submittedById: ctx.viewer!.id,
          },
          update: { submittedById: ctx.viewer!.id, submittedAt: new Date() },
        });

        // Notify opponent captain when they haven't submitted THIS block yet.
        if (!otherSideSubmitted) {
          const otherCaptain =
            side === "home"
              ? match.awayTeam?.captainId
              : match.homeTeam?.captainId;
          if (otherCaptain) {
            await new NotificationService(tx).create({
              type: "MATCH_SCHEDULED",
              title: "Opponent submitted a lineup",
              message: "Submit yours to unlock these games.",
              recipients: [otherCaptain],
              entity: {
                type: "MATCH",
                id: match.id,
                slug: match.matchday.competition.slug,
              },
              groupKey: `lineup-${match.id}-block-${blockOrder}`,
            });
          }
        }

        return tx.match.findUniqueOrThrow({ ...query, where: { id: match.id } });
      });
      publishMatchUpdate(matchId);
      return result;
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
            select: { competition: { select: { id: true, organizerId: true } } },
          },
        },
      });
      const isOrganizer =
        match.matchday.competition.organizerId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      // Round-48 — Team Captain or per-competition Roster Captain.
      const isCaptain =
        (await findCaptainSide(ctx, match, ctx.viewer.id)) !== null;
      if (!isOrganizer && !isCaptain && !isAdmin) {
        throw new GraphQLError("Only a captain or organizer may mark a walkover", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      // Round-60 — same published-block guard as recordMatchFrame.
      const woFrame = await ctx.prisma.matchFrame.findUnique({
        where: {
          matchId_frameNumber: { matchId: match.id, frameNumber: args.frameNumber },
        },
        select: { blockOrder: true },
      });
      if (woFrame?.blockOrder != null) {
        const published = await blockIsPublished(
          ctx.prisma,
          match.id,
          woFrame.blockOrder,
        );
        if (!published) {
          throw new GraphQLError("This block's lineup isn't published yet", {
            extensions: { code: "INVALID_TRANSITION" },
          });
        }
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
        await recomputeStandings(tx as never, match.matchday.competition.id);
        await recomputeMvp(tx as never, match.matchday.competition.id);
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
      // Round-48 — Team Captain or per-competition Roster Captain.
      const isCaptain =
        (await findCaptainSide(ctx, match, ctx.viewer.id)) !== null;
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
      "Round-60 — captain asks the opponent to re-open ONE published block for editing. Valid only while that block is the current (not-yet-decided) block.",
    args: {
      matchId: t.arg.id({ required: true }),
      blockOrder: t.arg.int({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const matchId = String(args.matchId);
      const blockOrder = args.blockOrder;
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: matchId },
        include: {
          homeTeam: { select: { captainId: true, name: true } },
          awayTeam: { select: { captainId: true, name: true } },
          matchday: { select: { competition: { select: { id: true, slug: true } } } },
        },
      });
      // Round-48 — Team Captain or per-competition Roster Captain.
      const sideLower = await findCaptainSide(ctx, match, ctx.viewer.id);
      const side: "HOME" | "AWAY" | null =
        sideLower === "home" ? "HOME" : sideLower === "away" ? "AWAY" : null;
      if (!side && ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Only a captain may request a lineup edit", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      if (match.status === "COMPLETED") {
        throw new GraphQLError("This match is already complete", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      if (!(await blockIsPublished(ctx.prisma, match.id, blockOrder))) {
        throw new GraphQLError("This block isn't published yet", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      // Can only re-open the CURRENT block (one whose frames aren't all
      // decided) — a finished block stays locked so earlier results hold.
      const blockFrames = await ctx.prisma.matchFrame.findMany({
        where: { matchId: match.id, blockOrder },
        select: { homeWon: true },
      });
      if (blockFrames.length > 0 && blockFrames.every((f) => f.homeWon !== null)) {
        throw new GraphQLError(
          "This block is already finished and can't be re-opened",
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
            lineupEditRequestedBlockOrder: blockOrder,
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
      "Opponent captain approves a pending lineup-edit request. Re-opens the requested block (deletes both sides' submission for it) so both re-submit; player assignments stay so each side only adjusts what changed.",
    args: { matchId: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const matchId = String(args.matchId);
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: matchId },
        include: {
          homeTeam: { select: { captainId: true } },
          awayTeam: { select: { captainId: true } },
          matchday: { select: { competition: { select: { id: true, slug: true } } } },
        },
      });
      if (!match.lineupEditRequestedAt) {
        throw new GraphQLError("No pending lineup edit request", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      // Only the OTHER captain (not the requester) can approve.
      // Round-48 — captain check accepts Team Captain OR per-comp Roster Captain.
      const requester = match.lineupEditRequestedById;
      const actorSide = await findCaptainSide(ctx, match, ctx.viewer.id);
      const isOtherCaptain =
        actorSide !== null && ctx.viewer.id !== requester;
      if (!isOtherCaptain && ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Only the other captain may approve", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      const reopenBlock = match.lineupEditRequestedBlockOrder;
      const updated = await ctx.prisma.$transaction(async (tx) => {
        // Re-open the requested block: drop both sides' submission so each
        // captain re-submits that block. Frame player assignments stay.
        if (reopenBlock != null) {
          await tx.matchBlockLineup.deleteMany({
            where: { matchId: match.id, blockOrder: reopenBlock },
          });
        }
        const m = await tx.match.update({
          ...query,
          where: { id: match.id },
          data: {
            lineupEditRequestedAt: null,
            lineupEditRequestedById: null,
            lineupEditRequestedSide: null,
            lineupEditRequestedBlockOrder: null,
          },
        });
        if (requester) {
          await new NotificationService(tx).create({
            type: "MATCH_SCHEDULED",
            title: "Lineup edit approved",
            message:
              "The block re-opened — submit your lineup again when you're ready.",
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
          matchday: { select: { competition: { select: { id: true, slug: true } } } },
        },
      });
      if (!match.lineupEditRequestedAt) {
        throw new GraphQLError("No pending lineup edit request", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      // Round-48 — captain check accepts Team Captain OR per-comp Roster Captain.
      const requester = match.lineupEditRequestedById;
      const actorSide = await findCaptainSide(ctx, match, ctx.viewer.id);
      const isOtherCaptain =
        actorSide !== null && ctx.viewer.id !== requester;
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
            lineupEditRequestedBlockOrder: null,
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
