import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { requireUser } from "@/lib/casl/guard";
import { recomputeStandings } from "@/lib/services/standings.service";
import { NotificationService } from "@/lib/services/notification.service";
import {
  SubmitMatchScoreInput,
  ReviewMatchScoreInput,
} from "../types/score-submission";

/**
 * Captain-side submit: each captain can post one submission per match.
 *  - If the *other* captain has already submitted and the scores match
 *    → mark BOTH as AUTO_APPROVED, complete the match, recompute standings.
 *  - If the scores DIFFER → both submissions land in CONFLICT, match stays
 *    incomplete, and the organizer is notified to resolve.
 *  - If nobody else has submitted yet → status PENDING, other captain notified.
 */
async function loadCaptainContext(
  prisma: import("@/lib/generated/prisma/client").PrismaClient,
  viewerId: string,
  viewerRole: string,
  matchId: string,
) {
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      homeTeam: { select: { id: true, name: true, captainId: true } },
      awayTeam: { select: { id: true, name: true, captainId: true } },
      matchday: {
        select: {
          competition: {
            select: { id: true, slug: true, name: true, organizerId: true },
          },
        },
      },
    },
  });
  let forTeamId: string | null = null;
  if (match.homeTeam?.captainId === viewerId) forTeamId = match.homeTeam.id;
  else if (match.awayTeam?.captainId === viewerId) forTeamId = match.awayTeam.id;
  if (!forTeamId && viewerRole !== "SUPER_ADMIN") {
    throw new GraphQLError("Only a participating captain may submit a score", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return { match, forTeamId };
}

builder.mutationFields((t) => ({
  submitMatchScore: t.prismaField({
    type: "MatchScoreSubmission",
    description:
      "Captain posts their match score. Both captains must agree; differing scores yield CONFLICT for organizer review.",
    args: { input: t.arg({ type: SubmitMatchScoreInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const matchId = String(args.input.matchId);
      const { match, forTeamId } = await loadCaptainContext(
        ctx.prisma,
        ctx.viewer.id,
        ctx.viewer.role,
        matchId,
      );
      if (match.status === "COMPLETED") {
        throw new GraphQLError("Match already completed", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      const teamId = forTeamId ?? match.homeTeamId ?? match.awayTeamId;
      if (!teamId) {
        throw new GraphQLError("Match has no teams to attribute the score to", {
          extensions: { code: "BAD_USER_INPUT" } ,
        });
      }
      const competitionId = match.matchday.competition.id;

      return ctx.prisma.$transaction(async (tx) => {
        // Upsert THIS captain's submission (status flips below based on the other side).
        const mine = await tx.matchScoreSubmission.upsert({
          where: {
            matchId_submittedById: {
              matchId: match.id,
              submittedById: ctx.viewer!.id,
            },
          },
          update: {
            forTeamId: teamId,
            homeScore: args.input.homeScore,
            awayScore: args.input.awayScore,
            note: args.input.note ?? null,
            status: "PENDING",
            reviewedById: null,
            reviewedAt: null,
          },
          create: {
            matchId: match.id,
            submittedById: ctx.viewer!.id,
            forTeamId: teamId,
            homeScore: args.input.homeScore,
            awayScore: args.input.awayScore,
            note: args.input.note ?? null,
            status: "PENDING",
          },
        });

        const otherCaptainId =
          match.homeTeam?.captainId === ctx.viewer!.id
            ? match.awayTeam?.captainId
            : match.homeTeam?.captainId;

        const other = otherCaptainId
          ? await tx.matchScoreSubmission.findUnique({
              where: {
                matchId_submittedById: {
                  matchId: match.id,
                  submittedById: otherCaptainId,
                },
              },
            })
          : null;

        if (!other) {
          // Solo submission — notify the other captain (if any).
          if (otherCaptainId) {
            await new NotificationService(tx).create({
              type: "MATCH_RESULT_RECORDED",
              title: `Score submitted for ${match.homeTeam?.name ?? "Home"} vs ${match.awayTeam?.name ?? "Away"}`,
              message: "Confirm or submit your own score.",
              recipients: [otherCaptainId],
              entity: {
                type: "MATCH",
                id: match.id,
                slug: match.matchday.competition.slug,
              },
              groupKey: `score-${match.id}`,
            });
          }
          return tx.matchScoreSubmission.findUniqueOrThrow({
            ...query,
            where: { id: mine.id },
          });
        }

        const agree =
          other.homeScore === args.input.homeScore &&
          other.awayScore === args.input.awayScore;

        if (agree) {
          // AUTO-APPROVE both, complete the match, recompute standings.
          await tx.matchScoreSubmission.updateMany({
            where: { matchId: match.id },
            data: {
              status: "AUTO_APPROVED",
              reviewedById: null,
              reviewedAt: new Date(),
            },
          });
          await tx.match.update({
            where: { id: match.id },
            data: {
              status: "COMPLETED",
              homeScore: args.input.homeScore,
              awayScore: args.input.awayScore,
              completedAt: new Date(),
            },
          });
          await recomputeStandings(tx as never, competitionId);
          await new NotificationService(tx).create({
            type: "MATCH_RESULT_RECORDED",
            title: `Match completed: ${match.homeTeam?.name ?? "Home"} ${args.input.homeScore} – ${args.input.awayScore} ${match.awayTeam?.name ?? "Away"}`,
            message: "Both captains agreed — standings updated.",
            recipients: [
              match.matchday.competition.organizerId,
              match.homeTeam?.captainId,
              match.awayTeam?.captainId,
            ].filter((id): id is string => !!id),
            entity: {
              type: "MATCH",
              id: match.id,
              slug: match.matchday.competition.slug,
            },
            groupKey: `score-${match.id}`,
          });
        } else {
          // CONFLICT — flag both, notify the organizer.
          await tx.matchScoreSubmission.updateMany({
            where: { matchId: match.id },
            data: { status: "CONFLICT" },
          });
          await new NotificationService(tx).create({
            type: "MATCH_RESULT_RECORDED",
            title: `Score conflict: ${match.homeTeam?.name ?? "Home"} vs ${match.awayTeam?.name ?? "Away"}`,
            message: "Captains disagree on the result — please review.",
            recipients: [match.matchday.competition.organizerId],
            entity: {
              type: "MATCH",
              id: match.id,
              slug: match.matchday.competition.slug,
            },
            groupKey: `score-conflict-${match.id}`,
          });
        }

        return tx.matchScoreSubmission.findUniqueOrThrow({
          ...query,
          where: { id: mine.id },
        });
      });
    },
  }),

  reviewMatchScore: t.prismaField({
    type: "Match",
    description:
      "Organizer / SUPER_ADMIN resolves a score (typically after CONFLICT) by entering the correct final score.",
    args: { input: t.arg({ type: ReviewMatchScoreInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const matchId = String(args.input.matchId);
      const match = await ctx.prisma.match.findUniqueOrThrow({
        where: { id: matchId },
        include: {
          homeTeam: { select: { name: true, captainId: true } },
          awayTeam: { select: { name: true, captainId: true } },
          matchday: {
            select: {
              competition: {
                select: { id: true, slug: true, organizerId: true },
              },
            },
          },
        },
      });
      const isOrganizer = match.matchday.competition.organizerId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isOrganizer && !isAdmin) {
        throw new GraphQLError("Only the organizer or admin may resolve a score", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      const competitionId = match.matchday.competition.id;
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
        // Mark all submissions APPROVED with reviewer info; non-matching ones REJECTED.
        const subs = await tx.matchScoreSubmission.findMany({
          where: { matchId: match.id },
        });
        await Promise.all(
          subs.map((s) =>
            tx.matchScoreSubmission.update({
              where: { id: s.id },
              data: {
                status:
                  s.homeScore === args.input.homeScore &&
                  s.awayScore === args.input.awayScore
                    ? "APPROVED"
                    : "REJECTED",
                reviewedById: ctx.viewer!.id,
                reviewedAt: new Date(),
                note: args.input.note ?? s.note,
              },
            }),
          ),
        );
        await recomputeStandings(tx as never, competitionId);
        await new NotificationService(tx).create({
          type: "MATCH_RESULT_RECORDED",
          title: `Resolved: ${match.homeTeam?.name ?? "Home"} ${args.input.homeScore} – ${args.input.awayScore} ${match.awayTeam?.name ?? "Away"}`,
          message: "Organizer set the final score.",
          recipients: [
            match.homeTeam?.captainId,
            match.awayTeam?.captainId,
          ].filter((id): id is string => !!id),
          entity: {
            type: "MATCH",
            id: match.id,
            slug: match.matchday.competition.slug,
          },
          groupKey: `score-${match.id}`,
        });
        return updated;
      });
    },
  }),
}));

builder.queryFields((t) => ({
  matchScoreSubmissions: t.prismaField({
    type: ["MatchScoreSubmission"],
    description:
      "Submissions list. Organizers see their competitions' submissions; admins see everything; players see only their own.",
    args: {
      matchId: t.arg.id(),
    },
    resolve: (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const where: import("@/lib/generated/prisma/client").Prisma.MatchScoreSubmissionWhereInput = {};
      if (args.matchId) where.matchId = String(args.matchId);
      if (ctx.viewer.role === "SUPER_ADMIN") {
        // no extra filter
      } else if (ctx.viewer.role === "ORGANIZER") {
        where.match = {
          matchday: {
            competition: { organizerId: ctx.viewer.id },
          },
        };
      } else {
        where.submittedById = ctx.viewer.id;
      }
      return ctx.prisma.matchScoreSubmission.findMany({
        ...query,
        where,
        orderBy: { createdAt: "desc" },
      });
    },
  }),

  matchScoreSubmissionsForMatch: t.prismaField({
    type: ["MatchScoreSubmission"],
    description: "All submissions for a single match (both captains' rows).",
    args: { matchId: t.arg.id({ required: true }) },
    resolve: (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      return ctx.prisma.matchScoreSubmission.findMany({
        ...query,
        where: { matchId: String(args.matchId) },
        orderBy: { createdAt: "asc" },
      });
    },
  }),
}));
