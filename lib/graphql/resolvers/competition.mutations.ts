import { GraphQLError } from "graphql";
import { builder } from "../builder";
import type { GraphQLContext } from "../context";
import {
  ApplyToCompetitionInput,
  CreateCompetitionInput,
  ReviewApplicationInput,
} from "../types/competition";
import { MatchFormatBlockInput } from "../types/structure";
import { ensure, requireUser } from "@/lib/casl/guard";
import type { CompetitionStatus } from "@/lib/generated/prisma/enums";
import { NotificationService } from "@/lib/services/notification.service";
import { assertNoCrossTeamRoster } from "@/lib/services/roster.service";

async function transition(
  ctx: GraphQLContext,
  query: { include?: unknown; select?: unknown },
  id: string,
  from: CompetitionStatus[],
  to: CompetitionStatus,
) {
  requireUser(ctx.viewer);
  const current = await ctx.prisma.competition.findUniqueOrThrow({
    where: { id },
  });
  ensure(ctx.ability, "update", {
    ...current,
    __caslSubjectType__: "Competition",
  });
  if (!from.includes(current.status)) {
    throw new GraphQLError(
      `Cannot transition from ${current.status} to ${to}`,
      { extensions: { code: "INVALID_TRANSITION" } },
    );
  }
  return ctx.prisma.competition.update({
    ...(query as object),
    where: { id },
    data: { status: to },
  });
}

const UpdateCompetitionInput = builder.inputType("UpdateCompetitionInput", {
  fields: (t) => ({
    name: t.string(),
    description: t.string(),
    rulesUrl: t.string(),
    cityId: t.id(),
    gameType: t.string(),
    format: t.string(),
    type: t.string(),
    minTeams: t.int(),
    maxTeams: t.int(),
    minPlayersPerTeam: t.int(),
    maxPlayersPerTeam: t.int(),
    raceToFrames: t.int(),
    startDate: t.field({ type: "DateTime" }),
    endDate: t.field({ type: "DateTime" }),
    prizePool: t.string(),
    currency: t.string(),
    bannerUrl: t.string(),
    schedulingType: t.string(),
    breakAndRunRule: t.boolean(),
    maxGamesPerVenuePerMatchday: t.int(),
    blocks: t.field({ type: [MatchFormatBlockInput] }),
  }),
});

builder.mutationFields((t) => ({
  createCompetition: t.prismaField({
    type: "Competition",
    description:
      "Create a competition (DRAFT). Any signed-in user can run their own tournament — they become its organizer and get full manage rights on it via per-entity CASL (mirrors per-team captaincy).",
    args: { input: t.arg({ type: CreateCompetitionInput, required: true }) },
    resolve: (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const viewerId = ctx.viewer.id;
      const i = args.input;
      return ctx.prisma.$transaction(async (tx) => {
        const created = await tx.competition.create({
          data: {
            name: i.name,
            slug: i.slug,
            description: i.description ?? null,
            rulesUrl: i.rulesUrl ?? null,
            cityId: i.cityId ? String(i.cityId) : null,
            organizerId: viewerId,
            type: i.type ?? "TEAMS",
            format: i.format ?? "ROUND_ROBIN",
            gameType: i.gameType ?? "EIGHT_BALL",
            maxTeams: i.maxTeams ?? null,
            minTeams: i.minTeams ?? 2,
            maxPlayersPerTeam: i.maxPlayersPerTeam ?? null,
            minPlayersPerTeam: i.minPlayersPerTeam ?? 1,
            raceToFrames: i.raceToFrames ?? 5,
            startDate: i.startDate ?? null,
            endDate: i.endDate ?? null,
            prizePool: i.prizePool ?? null,
            currency: i.currency ?? "VND",
            schedulingType: i.schedulingType ?? undefined,
            breakAndRunRule: i.breakAndRunRule ?? false,
            maxGamesPerVenuePerMatchday:
              i.maxGamesPerVenuePerMatchday ?? null,
          },
        });
        if (Array.isArray(i.blocks) && i.blocks.length > 0) {
          await tx.matchFormatBlock.createMany({
            data: i.blocks.map((b, idx) => ({
              competitionId: created.id,
              order: idx + 1,
              type: b.type,
              games: b.games,
              raceTo: b.raceTo ?? null,
              breakAfterMin: b.breakAfterMin ?? null,
            })),
          });
        }
        return tx.competition.findUniqueOrThrow({
          ...query,
          where: { id: created.id },
        });
      });
    },
  }),

  updateCompetition: t.prismaField({
    type: "Competition",
    description:
      "Edit a competition. Most fields are only editable while DRAFT.",
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateCompetitionInput, required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const c = await ctx.prisma.competition.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      ensure(ctx.ability, "update", {
        ...c,
        __caslSubjectType__: "Competition",
      });
      // Round-12 TASK 2: organizers can edit any field at any status while
      // the product spec settles. The gate is left as a one-line flip so we
      // can re-lock post-publish fields once the rules are final.
      // TODO: re-lock post-start fields later (structure / participants / dates).
      const editableEverything = true;
      const i = args.input;
      const data: Record<string, unknown> = {
        name: i.name ?? undefined,
        description: i.description === null ? null : i.description ?? undefined,
        rulesUrl: i.rulesUrl === null ? null : i.rulesUrl ?? undefined,
        bannerUrl: i.bannerUrl === null ? null : i.bannerUrl ?? undefined,
      };
      if (editableEverything) {
        Object.assign(data, {
          cityId: i.cityId ? String(i.cityId) : undefined,
          gameType: i.gameType ?? undefined,
          format: i.format ?? undefined,
          type: i.type ?? undefined,
          minTeams: i.minTeams ?? undefined,
          maxTeams: i.maxTeams === null ? null : i.maxTeams ?? undefined,
          minPlayersPerTeam: i.minPlayersPerTeam ?? undefined,
          maxPlayersPerTeam:
            i.maxPlayersPerTeam === null
              ? null
              : i.maxPlayersPerTeam ?? undefined,
          raceToFrames: i.raceToFrames ?? undefined,
          startDate: i.startDate ?? undefined,
          endDate: i.endDate ?? undefined,
          prizePool: i.prizePool === null ? null : i.prizePool ?? undefined,
          currency: i.currency ?? undefined,
          schedulingType: i.schedulingType ?? undefined,
          breakAndRunRule: i.breakAndRunRule ?? undefined,
          maxGamesPerVenuePerMatchday:
            i.maxGamesPerVenuePerMatchday === null
              ? null
              : i.maxGamesPerVenuePerMatchday ?? undefined,
        });
      }
      // Persist the update + an optional block-list replacement in one tx.
      return ctx.prisma.$transaction(async (tx) => {
        if (
          editableEverything &&
          Array.isArray(i.blocks) &&
          i.blocks.length > 0
        ) {
          await tx.matchFormatBlock.deleteMany({
            where: { competitionId: c.id },
          });
          await tx.matchFormatBlock.createMany({
            data: i.blocks.map((b, idx) => ({
              competitionId: c.id,
              order: idx + 1,
              type: b.type,
              games: b.games,
              raceTo: b.raceTo ?? null,
              breakAfterMin: b.breakAfterMin ?? null,
            })),
          });
        }
        return tx.competition.update({
          ...query,
          where: { id: c.id },
          data,
        });
      });
    },
  }),

  deleteCompetition: t.boolean({
    description: "Delete a DRAFT competition.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const c = await ctx.prisma.competition.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      ensure(ctx.ability, "delete", {
        ...c,
        __caslSubjectType__: "Competition",
      });
      if (c.status !== "DRAFT") {
        throw new GraphQLError(
          "Only DRAFT competitions can be deleted. Cancel instead.",
          { extensions: { code: "INVALID_TRANSITION" } },
        );
      }
      await ctx.prisma.competition.delete({ where: { id: c.id } });
      return true;
    },
  }),

  publishCompetition: t.prismaField({
    type: "Competition",
    description:
      "DRAFT → OPEN_FOR_APPLICATIONS. Validates structure (>=1 block, min teams >=2, dates valid).",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const c = await ctx.prisma.competition.findUniqueOrThrow({
        where: { id: String(args.id) },
        include: { blocks: { select: { id: true } } },
      });
      ensure(ctx.ability, "update", {
        ...c,
        __caslSubjectType__: "Competition",
      });
      // Structure validation
      if (c.blocks.length < 1) {
        throw new GraphQLError(
          "Add at least one match format block before publishing.",
          { extensions: { code: "INVALID_STRUCTURE" } },
        );
      }
      if (c.minTeams < 2) {
        throw new GraphQLError("Minimum 2 teams required to publish.", {
          extensions: { code: "INVALID_STRUCTURE" } },
        );
      }
      if (c.startDate && c.endDate && c.startDate >= c.endDate) {
        throw new GraphQLError("End date must be after start date.", {
          extensions: { code: "INVALID_STRUCTURE" } },
        );
      }
      return transition(
        ctx,
        query,
        c.id,
        ["DRAFT"],
        "OPEN_FOR_APPLICATIONS",
      );
    },
  }),

  closeApplications: t.prismaField({
    type: "Competition",
    description: "OPEN_FOR_APPLICATIONS → APPLICATIONS_CLOSED.",
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args, ctx) =>
      transition(
        ctx,
        query,
        String(args.id),
        ["OPEN_FOR_APPLICATIONS"],
        "APPLICATIONS_CLOSED",
      ),
  }),

  startCompetition: t.prismaField({
    type: "Competition",
    description: "APPLICATIONS_CLOSED|OPEN_FOR_APPLICATIONS → ONGOING.",
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args, ctx) =>
      transition(
        ctx,
        query,
        String(args.id),
        ["APPLICATIONS_CLOSED", "OPEN_FOR_APPLICATIONS"],
        "ONGOING",
      ),
  }),

  completeCompetition: t.prismaField({
    type: "Competition",
    description: "ONGOING → COMPLETED. Re-derives MVP on transition.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      const result = await transition(
        ctx,
        query,
        String(args.id),
        ["ONGOING"],
        "COMPLETED",
      );
      const { recomputeMvp } = await import("@/lib/services/standings.service");
      await recomputeMvp(ctx.prisma, String(args.id));
      return result;
    },
  }),

  reopenCompetition: t.prismaField({
    type: "Competition",
    description:
      "Round-20 — flip a COMPLETED competition back to ONGOING. Clears the frozen MVP flag and the winner banner state. Standings recompute from live match data.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const id = String(args.id);
      const c = await ctx.prisma.competition.findUniqueOrThrow({ where: { id } });
      ensure(ctx.ability, "update", {
        ...c,
        __caslSubjectType__: "Competition",
      });
      if (c.status !== "COMPLETED") {
        throw new GraphQLError("Only COMPLETED competitions can be reopened", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.competition.update({
          ...query,
          where: { id },
          data: { status: "ONGOING" },
        });
        // Clear the MVP flag so the winner banner falls back to "TBD" until
        // recomputeMvp runs on the next completion.
        await tx.playerCompStat.updateMany({
          where: { competitionId: id },
          data: { isMvp: false },
        });
        // Recompute standings live so any further match edits flow through.
        const { recomputeStandings } = await import(
          "@/lib/services/standings.service"
        );
        await recomputeStandings(tx as never, id);
        await new NotificationService(tx).create({
          type: "COMPETITION_STARTED",
          title: `${c.name} has been reopened`,
          message: "The organizer reopened this competition for further play.",
          recipients: [c.organizerId],
          entity: { type: "COMPETITION", id: c.id, slug: c.slug },
          groupKey: `reopen-${c.id}`,
        });
        return updated;
      });
    },
  }),

  cancelCompetition: t.prismaField({
    type: "Competition",
    description: "Cancel from any non-final status.",
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args, ctx) =>
      transition(
        ctx,
        query,
        String(args.id),
        ["DRAFT", "OPEN_FOR_APPLICATIONS", "APPLICATIONS_CLOSED", "ONGOING"],
        "CANCELLED",
      ),
  }),

  reopenCancelledCompetition: t.prismaField({
    type: "Competition",
    description:
      "Send a CANCELLED competition back to DRAFT so the organizer can rework or republish it.",
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args, ctx) =>
      transition(ctx, query, String(args.id), ["CANCELLED"], "DRAFT"),
  }),

  applyToCompetition: t.prismaField({
    type: "CompetitionApplication",
    description: "Submit a team application to a competition.",
    args: { input: t.arg({ type: ApplyToCompetitionInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const team = await ctx.prisma.team.findUniqueOrThrow({
        where: { id: String(args.input.teamId) },
      });
      if (team.captainId !== ctx.viewer.id && ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Only the team captain may apply", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      const competition = await ctx.prisma.competition.findUniqueOrThrow({
        where: { id: String(args.input.competitionId) },
      });
      if (competition.status !== "OPEN_FOR_APPLICATIONS") {
        throw new GraphQLError("Competition is not accepting applications", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      const players = (args.input.playerUserIds ?? []).map(String);
      // Cross-team roster guard (locks user→team in this competition).
      const app = await ctx.prisma.$transaction(async (tx) => {
        await assertNoCrossTeamRoster(tx, competition.id, team.id, players);
        const playerRows = players.length
          ? await Promise.all(
              players.map(async (userId) => {
                const u = await tx.user.findUniqueOrThrow({
                  where: { id: userId },
                  select: { name: true },
                });
                return { userId, name: u.name };
              }),
            )
          : [];
        // If a CANCELLED/REJECTED app already exists for this (comp, team),
        // resurrect it instead of hitting @@unique([competitionId,teamId]).
        const existing = await tx.competitionApplication.findUnique({
          where: {
            competitionId_teamId: {
              competitionId: competition.id,
              teamId: team.id,
            },
          },
        });
        if (existing && (existing.status === "CANCELLED" || existing.status === "REJECTED")) {
          await tx.applicationPlayer.deleteMany({
            where: { applicationId: existing.id },
          });
          return tx.competitionApplication.update({
            ...query,
            where: { id: existing.id },
            data: {
              status: "PENDING",
              message: args.input.message ?? null,
              reviewNote: null,
              reviewedAt: null,
              applicationPlayers: playerRows.length
                ? { create: playerRows }
                : undefined,
            },
          });
        }
        // Block re-applies for PENDING / WAITLISTED / APPROVED — otherwise we
        // fall through to .create() and crash on the @@unique constraint.
        if (existing) {
          throw new GraphQLError("Your team has already applied", {
            extensions: {
              code: "ALREADY_APPLIED",
              applicationStatus: existing.status,
              applicationId: existing.id,
            },
          });
        }
        return tx.competitionApplication.create({
          ...query,
          data: {
            competitionId: competition.id,
            teamId: team.id,
            message: args.input.message ?? null,
            applicationPlayers: playerRows.length
              ? { create: playerRows }
              : undefined,
          },
        });
      });
      // Notify the organizer that an application landed.
      await new NotificationService(ctx.prisma).create({
        type: "APPLICATION_SUBMITTED",
        title: `${team.name} applied to ${competition.name}`,
        message: "Review the application and decide.",
        recipients: [competition.organizerId],
        entity: {
          type: "APPLICATION",
          id: competition.id,
          slug: competition.slug,
        },
        groupKey: `app-${competition.id}`,
      });
      return app;
    },
  }),

  generateMatchdays: t.prismaField({
    type: "Competition",
    description:
      "Round-robin auto-pair every APPROVED team into matchdays. Idempotent: errors if matchdays already exist.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const competition = await ctx.prisma.competition.findUniqueOrThrow({
        where: { id: String(args.id) },
        include: { applications: { where: { status: "APPROVED" } } },
      });
      ensure(ctx.ability, "update", {
        ...competition,
        __caslSubjectType__: "Competition",
      });
      const existing = await ctx.prisma.matchday.count({
        where: { competitionId: competition.id },
      });
      if (existing > 0) {
        throw new GraphQLError(
          "Matchdays already generated for this competition.",
          { extensions: { code: "ALREADY_GENERATED" } },
        );
      }
      const teamIds = competition.applications.map((a) => a.teamId);
      if (teamIds.length < 2) {
        throw new GraphQLError(
          "Need at least 2 approved teams to generate matchdays.",
          { extensions: { code: "BAD_USER_INPUT" } },
        );
      }
      const { bergerPairings, assignVenuesWithCap } = await import(
        "@/lib/services/scheduling.service"
      );
      const rounds = bergerPairings(teamIds);

      // Round-47 — use the shared planner so the dates in the wizard's
      // Season Preview step are exactly what we persist here.
      const { planMatchdays } = await import(
        "@/lib/services/match-schedule.service"
      );
      const planned = planMatchdays({
        startDate: competition.startDate,
        endDate: competition.endDate,
        matchdayCount: rounds.length,
      });

      // Round-47 — venue assignment + max-games-per-venue cap. Default
      // to the home team's homeVenue; flip home/away when the cap would
      // be exceeded so the match plays at the away team's venue.
      const teams = await ctx.prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, homeVenueId: true },
      });
      const homeVenueByTeam = new Map<string, string | null>(
        teams.map((t) => [t.id, t.homeVenueId ?? null]),
      );
      const scheduled = assignVenuesWithCap(
        rounds,
        homeVenueByTeam,
        competition.maxGamesPerVenuePerMatchday ?? null,
      );

      // One transaction: bulk-create matchdays + matches + notifications.
      return ctx.prisma.$transaction(async (tx) => {
        for (let i = 0; i < rounds.length; i++) {
          const round = scheduled[i]!;
          const scheduledDate = new Date(planned[i]!.scheduledDate);
          const md = await tx.matchday.create({
            data: {
              competitionId: competition.id,
              number: i + 1,
              label: `Matchday ${i + 1}`,
              scheduledDate,
              isGenerated: true,
            },
          });
          if (round.length > 0) {
            await tx.match.createMany({
              data: round.map((m) => ({
                matchdayId: md.id,
                homeTeamId: m.home,
                awayTeamId: m.away,
                venueId: m.venueId,
                scheduledAt: scheduledDate,
                status: "SCHEDULED",
              })),
            });
          }
        }
        const captainRows = await tx.team.findMany({
          where: { id: { in: teamIds } },
          select: { captainId: true },
        });
        const recipients = Array.from(
          new Set([
            competition.organizerId,
            ...captainRows.map((c) => c.captainId),
          ]),
        );
        await new NotificationService(tx).create({
          type: "MATCH_SCHEDULED",
          title: `Schedule generated for ${competition.name}`,
          message: `${rounds.length} matchday${rounds.length === 1 ? "" : "s"} created.`,
          recipients,
          entity: {
            type: "COMPETITION",
            id: competition.id,
            slug: competition.slug,
          },
          groupKey: `gen-md-${competition.id}`,
        });
        return tx.competition.findUniqueOrThrow({
          ...query,
          where: { id: competition.id },
        });
      });
    },
  }),

  reviewApplication: t.prismaField({
    type: "CompetitionApplication",
    description: "Organizer approves or rejects an application.",
    args: { input: t.arg({ type: ReviewApplicationInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const app = await ctx.prisma.competitionApplication.findUniqueOrThrow({
        where: { id: String(args.input.applicationId) },
        include: {
          competition: true,
          team: { include: { members: { select: { userId: true } } } },
          applicationPlayers: { select: { userId: true } },
        },
      });
      ensure(
        ctx.ability,
        args.input.approve ? "approve" : "reject",
        { ...app, __caslSubjectType__: "CompetitionApplication" },
      );
      const updated = await ctx.prisma.$transaction(async (tx) => {
        if (args.input.approve) {
          const playerIds = app.applicationPlayers.map((p) => p.userId);
          // Re-check at approve time — another team may have applied first.
          await assertNoCrossTeamRoster(tx, app.competitionId, app.teamId, playerIds);
          if (playerIds.length > 0) {
            // The @@unique([competitionId, userId]) constraint is the final
            // arbiter under concurrent approvals.
            await tx.competitionRoster.createMany({
              data: playerIds.map((userId) => ({
                competitionId: app.competitionId,
                teamId: app.teamId,
                userId,
              })),
              skipDuplicates: false,
            });
          }
        }
        return tx.competitionApplication.update({
          where: { id: app.id },
          data: {
            status: args.input.approve ? "APPROVED" : "REJECTED",
            reviewNote: args.input.reviewNote ?? null,
            reviewedAt: new Date(),
          },
        });
      });
      // Fan-out: notify the captain + every team member.
      const recipients = Array.from(
        new Set([
          ...app.team.members.map((m) => m.userId),
          // also the captain explicitly in case they're not a TeamMember row
          (await ctx.prisma.team.findUniqueOrThrow({
            where: { id: app.teamId },
            select: { captainId: true },
          })).captainId,
        ]),
      );
      await new NotificationService(ctx.prisma).create({
        type: args.input.approve
          ? "APPLICATION_APPROVED"
          : "APPLICATION_REJECTED",
        title: args.input.approve
          ? `Approved: ${app.team.name} in ${app.competition.name}`
          : `Not approved: ${app.team.name} for ${app.competition.name}`,
        message:
          args.input.reviewNote ?? "The organizer has reviewed your application.",
        recipients,
        entity: {
          type: "COMPETITION",
          id: app.competition.id,
          slug: app.competition.slug,
        },
        groupKey: `app-decision-${app.id}`,
      });
      // Re-fetch with the caller's selection set.
      return ctx.prisma.competitionApplication.findUniqueOrThrow({
        ...query,
        where: { id: updated.id },
      });
    },
  }),

  editApplicationRoster: t.prismaField({
    type: "CompetitionApplication",
    description:
      "Captain (or SUPER_ADMIN) edits the roster on a PENDING application before review.",
    args: {
      id: t.arg.id({ required: true }),
      playerUserIds: t.arg.idList({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const app = await ctx.prisma.competitionApplication.findUniqueOrThrow({
        where: { id: String(args.id) },
        include: { team: { select: { captainId: true } } },
      });
      const isCaptain = app.team.captainId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isCaptain && !isAdmin) {
        throw new GraphQLError("Only the team captain or admin may edit", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      if (app.status !== "PENDING" && app.status !== "WAITLISTED") {
        throw new GraphQLError(
          "Only PENDING/WAITLISTED applications can have their roster edited",
          { extensions: { code: "INVALID_TRANSITION" } },
        );
      }
      const players = (args.playerUserIds ?? []).map(String);
      return ctx.prisma.$transaction(async (tx) => {
        await assertNoCrossTeamRoster(tx, app.competitionId, app.teamId, players);
        await tx.applicationPlayer.deleteMany({
          where: { applicationId: app.id },
        });
        if (players.length > 0) {
          const rows = await Promise.all(
            players.map(async (userId) => {
              const u = await tx.user.findUniqueOrThrow({
                where: { id: userId },
                select: { name: true },
              });
              return { applicationId: app.id, userId, name: u.name };
            }),
          );
          await tx.applicationPlayer.createMany({ data: rows });
        }
        return tx.competitionApplication.findUniqueOrThrow({
          ...query,
          where: { id: app.id },
        });
      });
    },
  }),

  withdrawApplication: t.prismaField({
    type: "CompetitionApplication",
    description:
      "Captain (or SUPER_ADMIN) withdraws a team's application before approval — frees up its roster slots.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const app = await ctx.prisma.competitionApplication.findUniqueOrThrow({
        where: { id: String(args.id) },
        include: { team: { select: { captainId: true } } },
      });
      const isCaptain = app.team.captainId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isCaptain && !isAdmin) {
        throw new GraphQLError("Only the team captain or admin may withdraw", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      if (app.status === "APPROVED") {
        // Once approved, the roster is locked — withdrawal must also remove the
        // CompetitionRoster rows so released players can re-apply elsewhere.
        await ctx.prisma.competitionRoster.deleteMany({
          where: { competitionId: app.competitionId, teamId: app.teamId },
        });
      }
      return ctx.prisma.competitionApplication.update({
        ...query,
        where: { id: app.id },
        data: { status: "CANCELLED", reviewedAt: new Date() },
      });
    },
  }),
}));
