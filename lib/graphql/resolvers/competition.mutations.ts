import { GraphQLError } from "graphql";
import { builder } from "../builder";
import type { GraphQLContext } from "../context";
import {
  ApplyToCompetitionInput,
  CreateCompetitionInput,
  ReviewApplicationInput,
  WeekdaySlotInput,
} from "../types/competition";
import { MatchFormatBlockInput } from "../types/structure";
import { ApplicationModeEnum, MatchVenueModeEnum } from "../types/enums";
import { ensure, requireUser } from "@/lib/casl/guard";
import type { CompetitionStatus } from "@/lib/generated/prisma/enums";
import { NotificationService } from "@/lib/services/notification.service";
import { assertNoCrossTeamRoster } from "@/lib/services/roster.service";
import {
  drainEmailQueue,
  enqueueEmail,
} from "@/lib/services/email-queue.service";
import { after } from "next/server";

// Round-53 — looks up a display name for a solo applicant; returns a
// generic fallback when the row is missing or the user has been deleted.
async function getApplicantName(
  ctx: GraphQLContext,
  userId: string | null,
): Promise<string> {
  if (!userId) return "Applicant";
  const u = await ctx.prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  return u?.name ?? "Applicant";
}

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
    requiresHomeVenue: t.boolean(),
    applicationMode: t.field({ type: ApplicationModeEnum }),
    invitedTeamIds: t.idList(),
    matchVenueMode: t.field({ type: MatchVenueModeEnum }),
    centralVenueId: t.id(),
    gamesPerOpponent: t.int(),
    weekdaySchedule: t.field({ type: [WeekdaySlotInput] }),
    fixedMatchDates: t.stringList(),
    maxGamesPerVenuePerMatchday: t.int(),
    blocks: t.field({ type: [MatchFormatBlockInput] }),
  }),
});

// Round-65 — MVP rating "calculator" config.
const UpdateMvpConfigInput = builder.inputType("UpdateMvpConfigInput", {
  fields: (t) => ({
    ptAppearance: t.int({ required: true }),
    ptSinglesWon: t.int({ required: true }),
    ptDoublesWon: t.int({ required: true }),
    ptBreakRun: t.int({ required: true }),
    minAppearancePct: t.int({ required: true }),
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
            // Sensible participant defaults so the create wizard's
            // Participants tab is prefilled with real, persisted values (not
            // just placeholders): max 24 teams, roster 3–8 players per team.
            maxTeams: i.maxTeams ?? 24,
            minTeams: i.minTeams ?? 2,
            maxPlayersPerTeam: i.maxPlayersPerTeam ?? 8,
            minPlayersPerTeam: i.minPlayersPerTeam ?? 3,
            raceToFrames: i.raceToFrames ?? 5,
            startDate: i.startDate ?? null,
            endDate: i.endDate ?? null,
            prizePool: i.prizePool ?? null,
            currency: i.currency ?? "VND",
            schedulingType: i.schedulingType ?? undefined,
            breakAndRunRule: i.breakAndRunRule ?? false,
            requiresHomeVenue: i.requiresHomeVenue ?? false,
            applicationMode: i.applicationMode ?? "OPEN",
            invitedTeamIds: Array.isArray(i.invitedTeamIds)
              ? i.invitedTeamIds.map(String)
              : undefined,
            matchVenueMode: i.matchVenueMode ?? "TEAM_VENUES",
            centralVenueId: i.centralVenueId ? String(i.centralVenueId) : null,
            // Default to Home & Away (2) so the Schedule tab is preselected.
            gamesPerOpponent: i.gamesPerOpponent ?? 2,
            weekdaySchedule: Array.isArray(i.weekdaySchedule)
              ? i.weekdaySchedule.map((w) => ({
                  weekday: w.weekday,
                  time: w.time,
                }))
              : undefined,
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
          requiresHomeVenue: i.requiresHomeVenue ?? undefined,
          applicationMode: i.applicationMode ?? undefined,
          invitedTeamIds: Array.isArray(i.invitedTeamIds)
            ? i.invitedTeamIds.map(String)
            : undefined,
          matchVenueMode: i.matchVenueMode ?? undefined,
          centralVenueId:
            i.centralVenueId === null
              ? null
              : i.centralVenueId
                ? String(i.centralVenueId)
                : undefined,
          gamesPerOpponent: i.gamesPerOpponent ?? undefined,
          weekdaySchedule: Array.isArray(i.weekdaySchedule)
            ? i.weekdaySchedule.map((w) => ({
                weekday: w.weekday,
                time: w.time,
              }))
            : undefined,
          // Round-58 — Fixed Match Day(s) ISO date list. Basic sanity filter
          // here; the matchday generator re-validates before use.
          fixedMatchDates: Array.isArray(i.fixedMatchDates)
            ? i.fixedMatchDates
                .map(String)
                .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
            : undefined,
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
      if (c.status !== "DRAFT") {
        throw new GraphQLError(
          `Cannot publish from ${c.status}`,
          { extensions: { code: "INVALID_TRANSITION" } },
        );
      }
      // Round-59 — publishing IS the moment a competition becomes public.
      // We force isPublic=true here (not just status) so a comp that was
      // private while DRAFT actually shows up under "Upcoming" on the
      // dashboard + /competitions once it's accepting teams. The CASL
      // public-read baseline gates on isPublic, so without this a
      // published-but-private comp stayed invisible to everyone but the
      // organizer and teams could never find it to apply.
      return ctx.prisma.competition.update({
        ...query,
        where: { id: c.id },
        data: { status: "OPEN_FOR_APPLICATIONS", isPublic: true },
      });
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
    resolve: async (query, _root, args, ctx) => {
      const id = String(args.id);
      const result = await transition(
        ctx,
        query,
        id,
        ["APPLICATIONS_CLOSED", "OPEN_FOR_APPLICATIONS"],
        "ONGOING",
      );
      // Seed the League Table with every confirmed team at 0 points so it's
      // populated the moment the competition goes live (even before the
      // calendar is generated / any match is played).
      const { recomputeStandings } = await import(
        "@/lib/services/standings.service"
      );
      await recomputeStandings(ctx.prisma as never, id);
      return result;
    },
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

  // Round-65 — organizer sets the MVP rating formula (point weights + the
  // minimum appearance % to be ranked), then the rating recomputes.
  updateMvpConfig: t.prismaField({
    type: "Competition",
    description:
      "Set the MVP rating formula (point weights + min appearance %) and recompute the rating.",
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateMvpConfigInput, required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const id = String(args.id);
      const c = await ctx.prisma.competition.findUniqueOrThrow({
        where: { id },
      });
      ensure(ctx.ability, "update", {
        ...c,
        __caslSubjectType__: "Competition",
      });
      const i = args.input;
      const nonNeg = (n: number) => Math.max(0, Math.round(n));
      await ctx.prisma.competition.update({
        where: { id },
        data: {
          mvpPtAppearance: nonNeg(i.ptAppearance),
          mvpPtSinglesWon: nonNeg(i.ptSinglesWon),
          mvpPtDoublesWon: nonNeg(i.ptDoublesWon),
          mvpPtBreakRun: nonNeg(i.ptBreakRun),
          mvpMinAppearancePct: Math.max(0, Math.min(100, Math.round(i.minAppearancePct))),
        },
      });
      const { recomputeMvp } = await import(
        "@/lib/services/standings.service"
      );
      await recomputeMvp(ctx.prisma, id);
      return ctx.prisma.competition.findUniqueOrThrow({
        ...query,
        where: { id },
      });
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
    resolve: async (query, _root, args, ctx) => {
      const id = String(args.id);
      // transition() guards the status + permission and flips the comp to
      // CANCELLED. It runs first so we never touch matches without the move
      // being allowed.
      const result = await transition(
        ctx,
        query,
        id,
        ["DRAFT", "OPEN_FOR_APPLICATIONS", "APPLICATIONS_CLOSED", "ONGOING"],
        "CANCELLED",
      );
      // Cancel the competition's not-yet-played matches so they don't linger
      // as SCHEDULED/IN_PROGRESS orphans (e.g. an "upcoming game" card on the
      // dashboard, or a row on a team's Matches tab). Completed matches keep
      // their result for history.
      await ctx.prisma.match.updateMany({
        where: {
          matchday: { competitionId: id },
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
        data: { status: "CANCELLED" },
      });
      return result;
    },
  }),

  reopenCancelledCompetition: t.prismaField({
    type: "Competition",
    description:
      "Send a CANCELLED competition back to DRAFT so the organizer can rework or republish it.",
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args, ctx) =>
      transition(ctx, query, String(args.id), ["CANCELLED"], "DRAFT"),
  }),

  setCompetitionLocks: t.prismaField({
    type: "Competition",
    description:
      "Round-50 — organizer/admin toggle for the two competition-level locks. " +
      "Nullable args leave the matching flag untouched. " +
      "registrationLocked blocks applyToCompetition + inviteTeamsToCompetition. " +
      "rosterLocked blocks captain-initiated RosterChangeRequest submissions.",
    args: {
      id: t.arg.id({ required: true }),
      registrationLocked: t.arg.boolean(),
      rosterLocked: t.arg.boolean(),
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
      return ctx.prisma.competition.update({
        ...query,
        where: { id: c.id },
        data: {
          ...(args.registrationLocked == null
            ? {}
            : { registrationLocked: args.registrationLocked }),
          ...(args.rosterLocked == null
            ? {}
            : { rosterLocked: args.rosterLocked }),
        },
      });
    },
  }),

  applyToCompetition: t.prismaField({
    type: "CompetitionApplication",
    description:
      "Submit an application to a competition. TEAMS and DOUBLES require a " +
      "teamId (and DOUBLES additionally requires the team to have exactly " +
      "two members); INDIVIDUAL omits teamId and the viewer registers as " +
      "the solo applicant.",
    args: { input: t.arg({ type: ApplyToCompetitionInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const competition = await ctx.prisma.competition.findUniqueOrThrow({
        where: { id: String(args.input.competitionId) },
      });
      if (competition.status !== "OPEN_FOR_APPLICATIONS") {
        throw new GraphQLError("Competition is not accepting applications", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      if (
        competition.registrationLocked &&
        ctx.viewer.role !== "SUPER_ADMIN"
      ) {
        throw new GraphQLError(
          "Registration is locked for this competition.",
          { extensions: { code: "REGISTRATION_LOCKED" } },
        );
      }

      // Round-53 — INDIVIDUAL competitions don't go through the team flow at
      // all. Validate inputs (no teamId allowed), check the applicant hasn't
      // already applied, then create/upsert a solo application.
      if (competition.type === "INDIVIDUAL") {
        if (args.input.teamId) {
          throw new GraphQLError(
            "Solo (Singles) competitions don't accept a teamId.",
            { extensions: { code: "INVALID_INPUT" } },
          );
        }
        const userId = ctx.viewer.id;
        const existing =
          await ctx.prisma.competitionApplication.findUnique({
            where: {
              competitionId_applicantUserId: {
                competitionId: competition.id,
                applicantUserId: userId,
              },
            },
          });
        if (
          existing &&
          (existing.status === "PENDING" ||
            existing.status === "APPROVED" ||
            existing.status === "WAITLISTED")
        ) {
          throw new GraphQLError("You've already applied.", {
            extensions: {
              code: "ALREADY_APPLIED",
              applicationStatus: existing.status,
              applicationId: existing.id,
            },
          });
        }
        const app = existing
          ? await ctx.prisma.competitionApplication.update({
              ...query,
              where: { id: existing.id },
              data: {
                status:
                  existing.status === "INVITED" ? "APPROVED" : "PENDING",
                message: args.input.message ?? null,
                reviewNote: null,
                reviewedAt:
                  existing.status === "INVITED" ? new Date() : null,
              },
            })
          : await ctx.prisma.competitionApplication.create({
              ...query,
              data: {
                competitionId: competition.id,
                applicantUserId: userId,
                message: args.input.message ?? null,
              },
            });
        await new NotificationService(ctx.prisma).create({
          type: "APPLICATION_SUBMITTED",
          title: `${ctx.viewer.name ?? "A player"} applied to ${competition.name}`,
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
      }

      // TEAMS / DOUBLES — teamId required from here on.
      if (!args.input.teamId) {
        throw new GraphQLError(
          "A team is required to apply to this competition.",
          { extensions: { code: "TEAM_REQUIRED" } },
        );
      }
      const team = await ctx.prisma.team.findUniqueOrThrow({
        where: { id: String(args.input.teamId) },
        include: { members: { where: { isActive: true }, select: { id: true } } },
      });
      if (team.captainId !== ctx.viewer.id && ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Only the team captain may apply", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      // Round-53 — DOUBLES (2v2) needs a team of exactly two players. We count
      // active TeamMember rows; admins still need to fix the team first since
      // the matchday generator relies on the strict 2-player invariant.
      if (competition.type === "DOUBLES" && team.members.length !== 2) {
        throw new GraphQLError(
          `Doubles competitions require a 2-player team — ${team.name} has ${team.members.length}.`,
          { extensions: { code: "DOUBLES_TEAM_SIZE" } },
        );
      }
      // Round-61 — the Figma apply form lets the captain choose the team's
      // home venue inline. Persist it on the team first so the gate below
      // sees the just-picked venue (the applicant is the captain, who's
      // authorized to set it).
      let teamHomeVenueId = team.homeVenueId;
      if (args.input.homeVenueId) {
        const venueId = String(args.input.homeVenueId);
        if (venueId !== teamHomeVenueId) {
          await ctx.prisma.team.update({
            where: { id: team.id },
            data: { homeVenueId: venueId },
          });
          teamHomeVenueId = venueId;
        }
      }
      // Round-48 / Round-61 — Figma gate "This competition requires each team
      // to have a home venue." Required when the organizer set it explicitly
      // OR the schedule is Home & Away on team venues (every team hosts, so
      // each needs a venue). Server-side enforcement runs alongside the apply
      // form's gate so the rule can't be bypassed by direct API calls.
      const homeAndAway =
        (competition.gamesPerOpponent ?? 1) >= 2 &&
        competition.matchVenueMode !== "CENTRAL_VENUE";
      const needsHomeVenue = competition.requiresHomeVenue || homeAndAway;
      if (needsHomeVenue && !teamHomeVenueId) {
        throw new GraphQLError(
          "This competition requires each team to have a home venue.",
          { extensions: { code: "HOME_VENUE_REQUIRED" } },
        );
      }
      // Round-48 (wizard) — Figma "How Participants Apply" → INVITE_ONLY.
      // Reject teams not on the organizer's invited-list. Admins bypass so
      // they can still apply on a team's behalf when correcting state.
      if (
        competition.applicationMode === "INVITE_ONLY" &&
        ctx.viewer.role !== "SUPER_ADMIN"
      ) {
        const invited = Array.isArray(competition.invitedTeamIds)
          ? (competition.invitedTeamIds as unknown[]).map(String)
          : [];
        if (!invited.includes(team.id)) {
          throw new GraphQLError(
            "This competition is invite-only — your team isn't on the invite list.",
            { extensions: { code: "NOT_INVITED" } },
          );
        }
      }
      const players = (args.input.playerUserIds ?? []).map(String);
      // Round-48 — per-competition Roster Captain. When the Team Captain is
      // not in the playing roster, they MUST nominate one of the roster
      // players to act as captain for this competition (manages lineups +
      // confirms results). If they ARE playing, this is optional and
      // ignored (defaults to themselves at runtime).
      const captainIsPlaying = players.includes(team.captainId);
      const rosterCaptainUserId = args.input.rosterCaptainUserId
        ? String(args.input.rosterCaptainUserId)
        : null;
      if (!captainIsPlaying && !rosterCaptainUserId) {
        throw new GraphQLError(
          "Since you're not participating, select a player to act as captain for this competition (manage lineups and confirm results).",
          { extensions: { code: "ROSTER_CAPTAIN_REQUIRED" } },
        );
      }
      if (rosterCaptainUserId && !players.includes(rosterCaptainUserId)) {
        throw new GraphQLError(
          "The Roster Captain must be one of the players you selected.",
          { extensions: { code: "ROSTER_CAPTAIN_NOT_IN_ROSTER" } },
        );
      }
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
        // Round-50 — INVITED rows are organizer-seeded. Accepting one auto-
        // approves: the organizer already vetted the team, so we skip the
        // review step, flip directly to APPROVED, and lock the picked players
        // into CompetitionRoster in the same transaction (matching
        // decideApplication's approve path). assertNoCrossTeamRoster ran
        // above, and the @@unique([competitionId,userId]) on CompetitionRoster
        // is the final arbiter under concurrent accepts.
        if (existing && existing.status === "INVITED") {
          await tx.applicationPlayer.deleteMany({
            where: { applicationId: existing.id },
          });
          const updated = await tx.competitionApplication.update({
            ...query,
            where: { id: existing.id },
            data: {
              status: "APPROVED",
              message: args.input.message ?? null,
              reviewNote: null,
              reviewedAt: new Date(),
              rosterCaptainUserId,
              applicationPlayers: playerRows.length
                ? { create: playerRows }
                : undefined,
            },
          });
          if (players.length > 0) {
            await tx.competitionRoster.createMany({
              data: players.map((userId) => ({
                competitionId: competition.id,
                teamId: team.id,
                userId,
              })),
              skipDuplicates: false,
            });
          }
          return updated;
        }
        // CANCELLED/REJECTED resurrection — back to PENDING for organizer
        // review (no organizer pre-approval implied).
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
              rosterCaptainUserId,
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
            rosterCaptainUserId,
            applicationPlayers: playerRows.length
              ? { create: playerRows }
              : undefined,
          },
        });
      });
      const svc = new NotificationService(ctx.prisma);
      // Round-50 — auto-accepted invite skips the organizer review step, so
      // the notification fan-out matches decideApplication's approve path
      // (team-wide APPLICATION_APPROVED + an FYI to the organizer that the
      // invite was accepted). Manual applies keep the existing "submitted —
      // please review" message to the organizer.
      if (app.status === "APPROVED") {
        const teamMembers = await ctx.prisma.teamMember.findMany({
          where: { teamId: team.id, isActive: true },
          select: { userId: true },
        });
        const teamRecipients = Array.from(
          new Set([...teamMembers.map((m) => m.userId), team.captainId]),
        );
        await svc.create({
          type: "APPLICATION_APPROVED",
          title: `You're in: ${team.name} in ${competition.name}`,
          message: "Your team is on the competition list — get ready to play.",
          recipients: teamRecipients,
          entity: {
            type: "COMPETITION",
            id: competition.id,
            slug: competition.slug,
          },
          groupKey: `app-decision-${app.id}`,
        });
        await svc.create({
          type: "APPLICATION_APPROVED",
          title: `Invite accepted: ${team.name} joined ${competition.name}`,
          message: "The team is locked in.",
          recipients: [competition.organizerId],
          entity: {
            type: "APPLICATION",
            id: competition.id,
            slug: competition.slug,
          },
          groupKey: `invite-accepted-${app.id}`,
        });
      } else {
        await svc.create({
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
      }
      // Round-48 — tell the chosen Roster Captain they've been nominated.
      // Only fires when the Team Captain isn't the Roster Captain themselves
      // (otherwise the captain would be notifying themselves on the same
      // action they just took).
      if (rosterCaptainUserId && rosterCaptainUserId !== ctx.viewer.id) {
        await svc.create({
          type: "ROSTER_CAPTAIN_ASSIGNED",
          title: `You're the Roster Captain for ${competition.name}`,
          message: `${team.name}'s captain nominated you to manage lineups and confirm results for this competition.`,
          recipients: [rosterCaptainUserId],
          entity: {
            type: "APPLICATION",
            id: competition.id,
            slug: competition.slug,
          },
          groupKey: `roster-captain-${competition.id}-${team.id}`,
        });
      }
      return app;
    },
  }),

  generateMatchdays: t.prismaField({
    type: "Competition",
    description:
      "Round-robin auto-pair every APPROVED team into matchdays and start the competition. Idempotent: errors if matchdays already exist. Optional maxGamesPerVenuePerMatchday caps how many games a venue hosts per matchday (persisted); use 1 so two teams sharing a home venue never both host on the same matchday.",
    args: {
      id: t.arg.id({ required: true }),
      maxGamesPerVenuePerMatchday: t.arg.int(),
    },
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
      // Round-53 — teamId is nullable on the model now (INDIVIDUAL
      // applications use applicantUserId instead). Matchday generation
      // is the team-flow only, so drop any solo rows here.
      const teamIds = competition.applications
        .map((a) => a.teamId)
        .filter((id): id is string => Boolean(id));
      if (teamIds.length < 2) {
        throw new GraphQLError(
          "Need at least 2 approved teams to generate matchdays.",
          { extensions: { code: "BAD_USER_INPUT" } },
        );
      }

      // Round-67 — single-elimination generates a knockout bracket (one
      // matchday per round) instead of a round-robin season.
      if (competition.format === "SINGLE_ELIMINATION") {
        const { buildBracket, nextSlot, roundName } = await import(
          "@/lib/services/bracket.service"
        );
        const { planMatchdays } = await import(
          "@/lib/services/match-schedule.service"
        );
        const plan = buildBracket(teamIds);
        const days = planMatchdays({
          startDate: competition.startDate,
          endDate: competition.endDate,
          matchdayCount: plan.totalRounds,
        });
        const centralVenueId =
          competition.matchVenueMode === "CENTRAL_VENUE"
            ? competition.centralVenueId
            : null;
        return ctx.prisma.$transaction(async (tx) => {
          // Matchday per round.
          const mdByRound = new Map<number, string>();
          for (let r = 1; r <= plan.totalRounds; r++) {
            const day = days[r - 1];
            const md = await tx.matchday.create({
              data: {
                competitionId: competition.id,
                number: r,
                label: roundName(r, plan.totalRounds),
                scheduledDate: day ? new Date(day.scheduledDate) : null,
                isGenerated: true,
              },
            });
            mdByRound.set(r, md.id);
          }
          // Create every match; capture ids keyed by round:position.
          const idByRP = new Map<string, string>();
          for (const bm of plan.matches) {
            const day = days[bm.round - 1];
            const created = await tx.match.create({
              data: {
                matchdayId: mdByRound.get(bm.round)!,
                homeTeamId: bm.home,
                awayTeamId: bm.away,
                venueId: centralVenueId,
                scheduledAt: day ? new Date(day.scheduledDate) : null,
                status: "SCHEDULED",
                bracketRound: bm.round,
                bracketPosition: bm.position,
              },
            });
            idByRP.set(`${bm.round}:${bm.position}`, created.id);
          }
          // Link winners → next match slot.
          for (const bm of plan.matches) {
            if (bm.round >= plan.totalRounds) continue;
            const nextId = idByRP.get(
              `${bm.round + 1}:${Math.floor(bm.position / 2)}`,
            )!;
            await tx.match.update({
              where: { id: idByRP.get(`${bm.round}:${bm.position}`)! },
              data: { nextMatchId: nextId, nextMatchSlot: nextSlot(bm.position) },
            });
          }
          // Auto-advance byes: the lone team moves straight into round 2.
          for (const bm of plan.matches) {
            if (!bm.isBye) continue;
            await tx.match.update({
              where: { id: idByRP.get(`${bm.round}:${bm.position}`)! },
              data: { status: "COMPLETED", completedAt: new Date() },
            });
            const nextId = idByRP.get(
              `${bm.round + 1}:${Math.floor(bm.position / 2)}`,
            )!;
            await tx.match.update({
              where: { id: nextId },
              data:
                nextSlot(bm.position) === "HOME"
                  ? { homeTeamId: bm.home }
                  : { awayTeamId: bm.home },
            });
          }
          const captainRows = await tx.team.findMany({
            where: { id: { in: teamIds } },
            select: { captainId: true },
          });
          await new NotificationService(tx).create({
            type: "MATCH_SCHEDULED",
            title: `Bracket generated for ${competition.name}`,
            message: `${plan.totalRounds} round${plan.totalRounds === 1 ? "" : "s"} — ${teamIds.length} teams.`,
            recipients: Array.from(
              new Set([
                competition.organizerId,
                ...captainRows.map((c) => c.captainId),
              ]),
            ),
            entity: {
              type: "COMPETITION",
              id: competition.id,
              slug: competition.slug,
            },
            groupKey: `gen-md-${competition.id}`,
          });
          const activate =
            competition.status === "OPEN_FOR_APPLICATIONS" ||
            competition.status === "APPLICATIONS_CLOSED";
          return tx.competition.update({
            ...query,
            where: { id: competition.id },
            data: { status: activate ? "ONGOING" : competition.status },
          });
        });
      }

      // The organizer's chosen venue cap (from the preview step) wins; else
      // fall back to whatever was configured on the competition. null =
      // unlimited.
      const cap =
        args.maxGamesPerVenuePerMatchday ??
        competition.maxGamesPerVenuePerMatchday ??
        null;
      const { computeSeasonSchedule, parseWeekdaySchedule } = await import(
        "@/lib/services/season-schedule.service"
      );
      const teams = await ctx.prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, homeVenueId: true },
      });
      const useCentral = competition.matchVenueMode === "CENTRAL_VENUE";
      const homeVenueByTeam = new Map<string, string | null>(
        teams.map((t) => [
          t.id,
          useCentral ? competition.centralVenueId ?? null : t.homeVenueId ?? null,
        ]),
      );
      // Identical computation to previewMatchdays — the previewed schedule is
      // exactly what we persist here.
      const schedule = computeSeasonSchedule({
        teamIds,
        gamesPerOpponent: competition.gamesPerOpponent ?? 1,
        startDate: competition.startDate,
        endDate: competition.endDate,
        weekdaySchedule: parseWeekdaySchedule(competition.weekdaySchedule),
        matchVenueMode: competition.matchVenueMode,
        centralVenueId: competition.centralVenueId,
        homeVenueByTeam,
        cap,
      });

      // One transaction: bulk-create matchdays + matches + notifications.
      return ctx.prisma.$transaction(async (tx) => {
        for (const day of schedule) {
          const scheduledDate = new Date(day.scheduledDate);
          const md = await tx.matchday.create({
            data: {
              competitionId: competition.id,
              number: day.number,
              label: day.label,
              scheduledDate,
              isGenerated: true,
            },
          });
          if (day.matches.length > 0) {
            await tx.match.createMany({
              data: day.matches.map((m) => ({
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
          message: `${schedule.length} matchday${schedule.length === 1 ? "" : "s"} created.`,
          recipients,
          entity: {
            type: "COMPETITION",
            id: competition.id,
            slug: competition.slug,
          },
          groupKey: `gen-md-${competition.id}`,
        });
        // Seed the League Table so every confirmed team shows at 0 points
        // from kickoff — an empty table on a freshly-started competition
        // reads like a bug. No completed matches yet → all zeros.
        const { recomputeStandings } = await import(
          "@/lib/services/standings.service"
        );
        await recomputeStandings(tx as never, competition.id);
        // Generating the calendar starts the competition: a pre-start comp
        // (OPEN_FOR_APPLICATIONS / APPLICATIONS_CLOSED) flips to ONGOING so it
        // shows as Active once the schedule exists. Anything else keeps its
        // status (generation can't run on COMPLETED — matchdays already exist).
        const activate =
          competition.status === "OPEN_FOR_APPLICATIONS" ||
          competition.status === "APPLICATIONS_CLOSED";
        return tx.competition.update({
          ...query,
          where: { id: competition.id },
          data: {
            status: activate ? "ONGOING" : competition.status,
            maxGamesPerVenuePerMatchday: cap,
          },
        });
      });
    },
  }),

  shiftMatchdayOnward: t.prismaField({
    type: "Matchday",
    description:
      "Move a matchday to a new date and re-slot every LATER matchday onto the competition's configured weekday schedule (e.g. Tue/Thu) — opens a gap in the schedule for a holiday without breaking the weekday pattern. Records an optional note on the moved matchday and moves not-yet-played matches with it. Organizer/admin only.",
    args: {
      matchdayId: t.arg.id({ required: true }),
      scheduledDate: t.arg({ type: "DateTime", required: true }),
      note: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const matchday = await ctx.prisma.matchday.findUniqueOrThrow({
        where: { id: String(args.matchdayId) },
        include: { competition: true },
      });
      ensure(ctx.ability, "update", {
        ...matchday.competition,
        __caslSubjectType__: "Competition",
      });
      if (!matchday.scheduledDate) {
        throw new GraphQLError("This matchday has no date to move.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const newDate = new Date(args.scheduledDate as unknown as string | Date);
      if (newDate.getTime() === matchday.scheduledDate.getTime()) {
        throw new GraphQLError("Pick a different date.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      // Keep chronological order: the moved matchday can't land on/before the
      // previous matchday's date. Later matchdays re-slot forward from the new
      // date, so their relative order is preserved automatically.
      const prev = await ctx.prisma.matchday.findFirst({
        where: {
          competitionId: matchday.competitionId,
          number: { lt: matchday.number },
          scheduledDate: { not: null },
        },
        orderBy: { number: "desc" },
        select: { scheduledDate: true },
      });
      if (
        prev?.scheduledDate &&
        newDate.getTime() <= prev.scheduledDate.getTime()
      ) {
        throw new GraphQLError(
          "The new date must be after the previous matchday.",
          { extensions: { code: "BAD_USER_INPUT" } },
        );
      }

      // This matchday + everything after it re-slots forward from `newDate`.
      const affected = await ctx.prisma.matchday.findMany({
        where: {
          competitionId: matchday.competitionId,
          number: { gte: matchday.number },
        },
        orderBy: { number: "asc" },
        select: { id: true, scheduledDate: true },
      });

      // Prefer the configured weekday schedule so moved matchdays stay on the
      // league's weekdays (Tue/Thu → Tue/Thu). If the competition has no
      // weekday schedule (fixed-date mode), fall back to a raw day-delta shift.
      const { parseWeekdaySchedule } = await import(
        "@/lib/services/season-schedule.service"
      );
      const { replanFromDate } = await import(
        "@/lib/services/match-schedule.service"
      );
      const slots = parseWeekdaySchedule(matchday.competition.weekdaySchedule);
      const replanned =
        slots.length > 0
          ? replanFromDate(newDate, slots, affected.length)
          : null;
      const delta = newDate.getTime() - matchday.scheduledDate.getTime();

      await ctx.prisma.$transaction(async (tx) => {
        for (let i = 0; i < affected.length; i++) {
          const md = affected[i];
          const shifted = replanned
            ? new Date(replanned[i])
            : md.scheduledDate
              ? new Date(md.scheduledDate.getTime() + delta)
              : null;
          await tx.matchday.update({
            where: { id: md.id },
            data: {
              ...(shifted ? { scheduledDate: shifted } : {}),
              ...(md.id === matchday.id ? { note: args.note ?? null } : {}),
            },
          });
          if (shifted) {
            // Not-yet-played matches inherit the new date; completed /
            // cancelled matches keep their historical timestamp.
            await tx.match.updateMany({
              where: {
                matchdayId: md.id,
                status: { in: ["SCHEDULED", "IN_PROGRESS", "POSTPONED"] },
              },
              data: { scheduledAt: shifted },
            });
          }
        }
      });

      // Notify the organizer + every captain with a match in the shifted range.
      const matches = await ctx.prisma.match.findMany({
        where: { matchdayId: { in: affected.map((a) => a.id) } },
        select: { homeTeamId: true, awayTeamId: true },
      });
      const teamIds = Array.from(
        new Set(
          matches
            .flatMap((m) => [m.homeTeamId, m.awayTeamId])
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const caps = teamIds.length
        ? await ctx.prisma.team.findMany({
            where: { id: { in: teamIds } },
            select: { captainId: true },
          })
        : [];
      const recipients = Array.from(
        new Set([
          matchday.competition.organizerId,
          ...caps.map((c) => c.captainId),
        ]),
      );
      if (recipients.length > 0) {
        await new NotificationService(ctx.prisma).create({
          type: "MATCH_SCHEDULED",
          title: `${matchday.competition.name} — Matchday ${matchday.number} moved`,
          message:
            args.note ??
            `Matchday ${matchday.number} and later matchdays were rescheduled.`,
          recipients,
          entity: {
            type: "COMPETITION",
            id: matchday.competition.id,
            slug: matchday.competition.slug,
          },
          groupKey: `shift-md-${matchday.id}-${newDate.getTime()}`,
        });
      }

      return ctx.prisma.matchday.findUniqueOrThrow({
        ...query,
        where: { id: matchday.id },
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
        // Round-53 — INDIVIDUAL apps have no team and no roster: approval
        // just flips the status, no CompetitionRoster rows to create. The
        // team path keeps the existing cross-team guard.
        if (args.input.approve && app.teamId) {
          const playerIds = app.applicationPlayers.map((p) => p.userId);
          await assertNoCrossTeamRoster(tx, app.competitionId, app.teamId!, playerIds);
          if (playerIds.length > 0) {
            await tx.competitionRoster.createMany({
              data: playerIds.map((userId) => ({
                competitionId: app.competitionId,
                teamId: app.teamId!,
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
      // Fan-out: notify the captain + every team member (TEAMS/DOUBLES),
      // or the lone applicant on a solo INDIVIDUAL row.
      const recipients = app.team
        ? Array.from(
            new Set([
              ...app.team.members.map((m) => m.userId),
              (await ctx.prisma.team.findUniqueOrThrow({
                where: { id: app.teamId! },
                select: { captainId: true },
              })).captainId,
            ]),
          )
        : app.applicantUserId
          ? [app.applicantUserId]
          : [];
      const subjectName =
        app.team?.name ?? (await getApplicantName(ctx, app.applicantUserId));
      await new NotificationService(ctx.prisma).create({
        type: args.input.approve
          ? "APPLICATION_APPROVED"
          : "APPLICATION_REJECTED",
        title: args.input.approve
          ? `Approved: ${subjectName} in ${app.competition.name}`
          : `Not approved: ${subjectName} for ${app.competition.name}`,
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
      "Edit an application's roster directly. " +
      "Captain (or organizer/admin) on PENDING/WAITLISTED applies in-place. " +
      "Round-50 — organizer or SUPER_ADMIN may also edit on APPROVED apps, " +
      "in which case CompetitionRoster is synced + any PENDING " +
      "RosterChangeRequest is cancelled (captains use requestRosterChange " +
      "to propose changes to APPROVED rosters and need review).",
    args: {
      id: t.arg.id({ required: true }),
      playerUserIds: t.arg.idList({ required: true }),
      // Optional — required when the new roster excludes the Team Captain.
      rosterCaptainUserId: t.arg.id(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const app = await ctx.prisma.competitionApplication.findUniqueOrThrow({
        where: { id: String(args.id) },
        include: {
          team: { select: { captainId: true, members: { where: { isActive: true }, select: { userId: true } } } },
          competition: { select: { id: true, organizerId: true, minPlayersPerTeam: true, maxPlayersPerTeam: true } },
        },
      });
      // Round-53 — only team-based rows have a roster. Solo INDIVIDUAL
      // rows reject all roster-edit attempts.
      if (!app.team) {
        throw new GraphQLError(
          "This application has no team roster to edit.",
          { extensions: { code: "NO_TEAM_ROSTER" } },
        );
      }
      const isCaptain = app.team.captainId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      const isOrganizer = app.competition.organizerId === ctx.viewer.id;
      if (!isCaptain && !isAdmin && !isOrganizer) {
        throw new GraphQLError(
          "Only the team captain, competition organizer, or admin may edit this roster",
          { extensions: { code: "FORBIDDEN" } },
        );
      }
      // APPROVED apps go through the review workflow for captains; only the
      // organizer/admin can edit them in-place.
      if (app.status === "APPROVED" && !isOrganizer && !isAdmin) {
        throw new GraphQLError(
          "Captains propose roster changes via requestRosterChange — the organizer or admin reviews them.",
          { extensions: { code: "REVIEW_REQUIRED" } },
        );
      }
      if (
        app.status !== "PENDING" &&
        app.status !== "WAITLISTED" &&
        app.status !== "APPROVED"
      ) {
        throw new GraphQLError(
          "This application's roster can't be edited in its current state.",
          { extensions: { code: "INVALID_TRANSITION" } },
        );
      }
      const players = Array.from(
        new Set((args.playerUserIds ?? []).map(String)),
      ).filter(Boolean);
      const min = app.competition.minPlayersPerTeam;
      const max = app.competition.maxPlayersPerTeam;
      if (players.length < min) {
        throw new GraphQLError(
          `This competition needs at least ${min} player${min === 1 ? "" : "s"} per team.`,
          { extensions: { code: "ROSTER_TOO_SMALL" } },
        );
      }
      if (max != null && players.length > max) {
        throw new GraphQLError(
          `This competition caps rosters at ${max} players.`,
          { extensions: { code: "ROSTER_TOO_LARGE" } },
        );
      }
      // Every player must actually be on the team.
      const teamMemberIds = new Set(app.team.members.map((m) => m.userId));
      teamMemberIds.add(app.team.captainId);
      const outsiders = players.filter((id) => !teamMemberIds.has(id));
      if (outsiders.length > 0) {
        throw new GraphQLError(
          "One or more proposed players aren't on the team roster.",
          {
            extensions: {
              code: "PLAYER_NOT_TEAM_MEMBER",
              userIds: outsiders,
            },
          },
        );
      }
      const captainInRoster = players.includes(app.team.captainId);
      const rosterCaptainUserId = args.rosterCaptainUserId
        ? String(args.rosterCaptainUserId)
        : app.rosterCaptainUserId;
      if (!captainInRoster) {
        if (!rosterCaptainUserId) {
          throw new GraphQLError(
            "Since the Team Captain isn't in the roster, pick a player to act as Roster Captain.",
            { extensions: { code: "ROSTER_CAPTAIN_REQUIRED" } },
          );
        }
        if (!players.includes(rosterCaptainUserId)) {
          throw new GraphQLError(
            "The Roster Captain must be one of the selected players.",
            { extensions: { code: "ROSTER_CAPTAIN_NOT_IN_ROSTER" } },
          );
        }
      }
      return ctx.prisma.$transaction(async (tx) => {
        if (app.status === "APPROVED") {
          // Diff the locked roster and sync CompetitionRoster in step with
          // applicationPlayers so the Players tab + apply-flow conflict
          // checks stay consistent.
          const currentRoster = await tx.competitionRoster.findMany({
            where: { competitionId: app.competitionId, teamId: app.teamId! },
            select: { userId: true },
          });
          const currentSet = new Set(currentRoster.map((r) => r.userId));
          const proposedSet = new Set(players);
          const toAdd = players.filter((id) => !currentSet.has(id));
          const toRemove = [...currentSet].filter((id) => !proposedSet.has(id));
          if (toAdd.length > 0) {
            await assertNoCrossTeamRoster(tx, app.competitionId, app.teamId!, toAdd);
          }
          if (toRemove.length > 0) {
            await tx.competitionRoster.deleteMany({
              where: {
                competitionId: app.competitionId,
                teamId: app.teamId!,
                userId: { in: toRemove },
              },
            });
          }
          if (toAdd.length > 0) {
            await tx.competitionRoster.createMany({
              data: toAdd.map((userId) => ({
                competitionId: app.competitionId,
                teamId: app.teamId!,
                userId,
              })),
              skipDuplicates: false,
            });
          }
          // An admin/organizer in-place edit supersedes any captain proposal.
          await tx.rosterChangeRequest.updateMany({
            where: { applicationId: app.id, status: "PENDING" },
            data: { status: "CANCELLED" },
          });
        } else {
          // PENDING / WAITLISTED — just guard against cross-team conflicts on
          // the live application set (matches the legacy behavior).
          await assertNoCrossTeamRoster(tx, app.competitionId, app.teamId!, players);
        }
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
        await tx.competitionApplication.update({
          where: { id: app.id },
          data: { rosterCaptainUserId: captainInRoster ? null : rosterCaptainUserId },
        });
        return tx.competitionApplication.findUniqueOrThrow({
          ...query,
          where: { id: app.id },
        });
      });
    },
  }),

  requestRosterChange: t.prismaField({
    type: "RosterChangeRequest",
    description:
      "Round-50 — captain (or SUPER_ADMIN) proposes a roster swap on an " +
      "APPROVED application. Stored as a PENDING RosterChangeRequest with " +
      "the proposed user ids; CompetitionRoster + applicationPlayers stay " +
      "locked until decideRosterChangeRequest approves. Replaces any " +
      "previously-PENDING request from the same captain (the new one wins).",
    args: {
      applicationId: t.arg.id({ required: true }),
      playerUserIds: t.arg.idList({ required: true }),
      message: t.arg.string(),
      // Optional — needed when the proposed roster no longer includes the
      // Team Captain (Round-48 rule: someone in the roster must be captain).
      // Null leaves the existing rosterCaptainUserId untouched (the resolver
      // validates it's actually in the proposed set).
      rosterCaptainUserId: t.arg.id(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const app = await ctx.prisma.competitionApplication.findUniqueOrThrow({
        where: { id: String(args.applicationId) },
        include: {
          team: { include: { members: { where: { isActive: true } } } },
          competition: true,
        },
      });
      if (!app.team) {
        throw new GraphQLError(
          "Solo applications can't request roster changes.",
          { extensions: { code: "NO_TEAM_ROSTER" } },
        );
      }
      const isCaptain = app.team.captainId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isCaptain && !isAdmin) {
        throw new GraphQLError(
          "Only the team captain or admin may propose a roster change",
          { extensions: { code: "FORBIDDEN" } },
        );
      }
      if (app.status !== "APPROVED") {
        throw new GraphQLError(
          "Roster changes can only be proposed on APPROVED applications.",
          { extensions: { code: "INVALID_TRANSITION" } },
        );
      }
      if (app.competition.rosterLocked && !isAdmin) {
        throw new GraphQLError(
          "Roster edits are locked for this competition.",
          { extensions: { code: "ROSTER_LOCKED" } },
        );
      }
      const proposed = Array.from(
        new Set((args.playerUserIds ?? []).map(String)),
      ).filter(Boolean);
      if (proposed.length === 0) {
        throw new GraphQLError("Pick at least one player.", {
          extensions: { code: "EMPTY_ROSTER" },
        });
      }
      const minPlayers = app.competition.minPlayersPerTeam;
      const maxPlayers = app.competition.maxPlayersPerTeam;
      if (proposed.length < minPlayers) {
        throw new GraphQLError(
          `This competition needs at least ${minPlayers} player${minPlayers === 1 ? "" : "s"} per team.`,
          { extensions: { code: "ROSTER_TOO_SMALL" } },
        );
      }
      if (maxPlayers != null && proposed.length > maxPlayers) {
        throw new GraphQLError(
          `This competition caps rosters at ${maxPlayers} players.`,
          { extensions: { code: "ROSTER_TOO_LARGE" } },
        );
      }
      // Every proposed player must be an active TeamMember of this team.
      const teamMemberIds = new Set(app.team.members.map((m) => m.userId));
      teamMemberIds.add(app.team.captainId);
      const outsiders = proposed.filter((id) => !teamMemberIds.has(id));
      if (outsiders.length > 0) {
        throw new GraphQLError(
          `One or more proposed players aren't on the team roster.`,
          {
            extensions: {
              code: "PLAYER_NOT_TEAM_MEMBER",
              userIds: outsiders,
            },
          },
        );
      }
      // Round-48 rule — someone in the playing roster must be the captain.
      const captainInRoster = proposed.includes(app.team.captainId);
      const rosterCaptainUserId = args.rosterCaptainUserId
        ? String(args.rosterCaptainUserId)
        : app.rosterCaptainUserId;
      if (!captainInRoster) {
        if (!rosterCaptainUserId) {
          throw new GraphQLError(
            "Since the Team Captain isn't in the proposed roster, pick a player to act as Roster Captain.",
            { extensions: { code: "ROSTER_CAPTAIN_REQUIRED" } },
          );
        }
        if (!proposed.includes(rosterCaptainUserId)) {
          throw new GraphQLError(
            "The Roster Captain must be one of the proposed players.",
            { extensions: { code: "ROSTER_CAPTAIN_NOT_IN_ROSTER" } },
          );
        }
      }
      // Cross-team check only for NEWLY added players. Players already on
      // this team's locked roster are staying — no conflict.
      const currentRoster = await ctx.prisma.competitionRoster.findMany({
        where: { competitionId: app.competitionId, teamId: app.teamId! },
        select: { userId: true },
      });
      const currentSet = new Set(currentRoster.map((r) => r.userId));
      const added = proposed.filter((id) => !currentSet.has(id));
      if (added.length > 0) {
        await assertNoCrossTeamRoster(
          ctx.prisma,
          app.competitionId,
          app.teamId!,
          added,
        );
      }
      // Replace any prior PENDING request — only one open proposal per app.
      return ctx.prisma.$transaction(async (tx) => {
        await tx.rosterChangeRequest.updateMany({
          where: { applicationId: app.id, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
        const created = await tx.rosterChangeRequest.create({
          ...query,
          data: {
            applicationId: app.id,
            requestedById: ctx.viewer!.id,
            message: args.message ?? null,
            proposedPlayers: {
              create: proposed.map((userId) => ({ userId })),
            },
          },
        });
        return created;
      });
    },
  }),

  cancelRosterChangeRequest: t.prismaField({
    type: "RosterChangeRequest",
    description:
      "Captain (or SUPER_ADMIN) withdraws their own PENDING roster change request.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const req = await ctx.prisma.rosterChangeRequest.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      const isOwner = req.requestedById === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isOwner && !isAdmin) {
        throw new GraphQLError(
          "Only the captain who opened this request (or an admin) can cancel it.",
          { extensions: { code: "FORBIDDEN" } },
        );
      }
      if (req.status !== "PENDING") {
        throw new GraphQLError("This roster change request isn't pending.", {
          extensions: { code: "INVALID_TRANSITION" } },
        );
      }
      return ctx.prisma.rosterChangeRequest.update({
        ...query,
        where: { id: req.id },
        data: { status: "CANCELLED" },
      });
    },
  }),

  decideRosterChangeRequest: t.prismaField({
    type: "RosterChangeRequest",
    description:
      "Round-50 — organizer/admin approves or rejects a PENDING " +
      "RosterChangeRequest. Approval atomically swaps CompetitionRoster + " +
      "applicationPlayers to the proposed set; rejection leaves both alone.",
    args: {
      id: t.arg.id({ required: true }),
      approve: t.arg.boolean({ required: true }),
      reviewNote: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const req = await ctx.prisma.rosterChangeRequest.findUniqueOrThrow({
        where: { id: String(args.id) },
        include: {
          application: { include: { competition: true, team: true } },
          proposedPlayers: true,
        },
      });
      // Reuse existing CASL gate — approving/rejecting a roster change is
      // semantically a review on the parent application.
      ensure(
        ctx.ability,
        args.approve ? "approve" : "reject",
        { ...req.application, __caslSubjectType__: "CompetitionApplication" },
      );
      if (req.status !== "PENDING") {
        throw new GraphQLError("This roster change request isn't pending.", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      if (!args.approve) {
        const updated = await ctx.prisma.rosterChangeRequest.update({
          ...query,
          where: { id: req.id },
          data: {
            status: "REJECTED",
            reviewNote: args.reviewNote ?? null,
            reviewedAt: new Date(),
            reviewedById: ctx.viewer.id,
          },
        });
        await new NotificationService(ctx.prisma).create({
          type: "APPLICATION_REJECTED",
          title: `Roster change rejected for ${req.application.team?.name}`,
          message:
            args.reviewNote ??
            "The organizer rejected your proposed roster change.",
          recipients: [req.requestedById],
          entity: {
            type: "APPLICATION",
            id: req.application.competitionId,
            slug: req.application.competition.slug,
          },
          groupKey: `roster-change-decision-${req.id}`,
        });
        return updated;
      }
      // Approve path — diff proposed vs. locked, then sync atomically.
      const proposed = req.proposedPlayers.map((p) => p.userId);
      const currentRoster = await ctx.prisma.competitionRoster.findMany({
        where: {
          competitionId: req.application.competitionId,
          teamId: req.application.teamId!,
        },
        select: { userId: true },
      });
      const currentSet = new Set(currentRoster.map((r) => r.userId));
      const proposedSet = new Set(proposed);
      const toAdd = proposed.filter((id) => !currentSet.has(id));
      const toRemove = [...currentSet].filter((id) => !proposedSet.has(id));
      const updated = await ctx.prisma.$transaction(async (tx) => {
        // Re-check cross-team for newly-added players at decide time —
        // another team may have rostered them since the request was filed.
        if (toAdd.length > 0) {
          await assertNoCrossTeamRoster(
            tx,
            req.application.competitionId,
            req.application.teamId!,
            toAdd,
          );
        }
        if (toRemove.length > 0) {
          await tx.competitionRoster.deleteMany({
            where: {
              competitionId: req.application.competitionId,
              teamId: req.application.teamId!,
              userId: { in: toRemove },
            },
          });
        }
        if (toAdd.length > 0) {
          await tx.competitionRoster.createMany({
            data: toAdd.map((userId) => ({
              competitionId: req.application.competitionId,
              teamId: req.application.teamId!,
              userId,
            })),
            skipDuplicates: false,
          });
        }
        // Sync applicationPlayers to mirror the new locked set so the apply-
        // detail view and decideApplication's other read sites stay coherent.
        await tx.applicationPlayer.deleteMany({
          where: { applicationId: req.application.id },
        });
        if (proposed.length > 0) {
          const rows = await Promise.all(
            proposed.map(async (userId) => {
              const u = await tx.user.findUniqueOrThrow({
                where: { id: userId },
                select: { name: true },
              });
              return { applicationId: req.application.id, userId, name: u.name };
            }),
          );
          await tx.applicationPlayer.createMany({ data: rows });
        }
        // If the Team Captain isn't in the new roster, ensure
        // rosterCaptainUserId points at a player who is. The request resolver
        // already validates this; we just confirm to keep the invariant on
        // disk consistent after async-state changes (e.g. captain swap).
        const captainInRoster = proposed.includes(req.application.team?.captainId ?? "");
        let rosterCaptainUserId = req.application.rosterCaptainUserId;
        if (!captainInRoster && rosterCaptainUserId && !proposedSet.has(rosterCaptainUserId)) {
          rosterCaptainUserId = null;
        }
        await tx.competitionApplication.update({
          where: { id: req.application.id },
          data: { rosterCaptainUserId },
        });
        return tx.rosterChangeRequest.update({
          ...query,
          where: { id: req.id },
          data: {
            status: "APPROVED",
            reviewNote: args.reviewNote ?? null,
            reviewedAt: new Date(),
            reviewedById: ctx.viewer!.id,
          },
        });
      });
      await new NotificationService(ctx.prisma).create({
        type: "APPLICATION_APPROVED",
        title: `Roster updated for ${req.application.team?.name}`,
        message:
          args.reviewNote ??
          "Your proposed roster is now the locked roster for this competition.",
        recipients: [req.requestedById],
        entity: {
          type: "APPLICATION",
          id: req.application.competitionId,
          slug: req.application.competition.slug,
        },
        groupKey: `roster-change-decision-${req.id}`,
      });
      return updated;
    },
  }),

  inviteTeamsToCompetition: t.prismaField({
    type: ["CompetitionApplication"],
    description:
      "Round-49 — organizer batch-invites teams to a competition. Idempotent: " +
      "an existing INVITED row counts as a re-invite (notification + email " +
      "fire again); existing PENDING/APPROVED/WAITLISTED rows are skipped " +
      "untouched. Sends an in-app notification to every team member and an " +
      "email to the team captain.",
    args: {
      competitionId: t.arg.id({ required: true }),
      teamIds: t.arg.idList({ required: true }),
      personalNote: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const competition = await ctx.prisma.competition.findUniqueOrThrow({
        where: { id: String(args.competitionId) },
      });
      // Only the organizer who owns this competition (or an admin) can fire
      // invites — anything else would let any organizer spam every team.
      const isOwner = competition.organizerId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isOwner && !isAdmin) {
        throw new GraphQLError("Only the competition organizer may invite teams", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      if (
        competition.status !== "OPEN_FOR_APPLICATIONS" &&
        competition.status !== "DRAFT" &&
        competition.status !== "APPLICATIONS_CLOSED"
      ) {
        throw new GraphQLError(
          "Invites can only be sent while the competition is DRAFT, OPEN_FOR_APPLICATIONS, or APPLICATIONS_CLOSED.",
          { extensions: { code: "INVALID_TRANSITION" } },
        );
      }
      // Round-50 — admin lock blocks new invites too. SUPER_ADMIN bypasses.
      if (competition.registrationLocked && !isAdmin) {
        throw new GraphQLError(
          "Registration is locked for this competition.",
          { extensions: { code: "REGISTRATION_LOCKED" } },
        );
      }
      const ids = Array.from(
        new Set((args.teamIds ?? []).map((x) => String(x))),
      ).filter(Boolean);
      if (!ids.length) {
        throw new GraphQLError("Pick at least one team to invite.", {
          extensions: { code: "EMPTY_INVITE_LIST" },
        });
      }
      const teams = await ctx.prisma.team.findMany({
        where: { id: { in: ids } },
        include: {
          captain: { select: { id: true, name: true, email: true } },
          members: { select: { userId: true } },
        },
      });
      if (teams.length !== ids.length) {
        const found = new Set(teams.map((t) => t.id));
        const missing = ids.filter((id) => !found.has(id));
        throw new GraphQLError(
          `Unknown team id${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
          { extensions: { code: "TEAM_NOT_FOUND" } },
        );
      }
      const organizer = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: competition.organizerId },
        select: { name: true },
      });
      // Process each team: skip ones already on the team-side flow, otherwise
      // upsert an INVITED row, then fan out notifications + emails. We avoid
      // a single $transaction so an SMTP hiccup doesn't roll back the whole
      // batch — emails are best-effort by design.
      const note = args.personalNote?.trim() || null;
      const results: { id: string }[] = [];
      const svc = new NotificationService(ctx.prisma);
      for (const team of teams) {
        const existing = await ctx.prisma.competitionApplication.findUnique({
          where: {
            competitionId_teamId: {
              competitionId: competition.id,
              teamId: team.id,
            },
          },
        });
        if (
          existing &&
          (existing.status === "PENDING" ||
            existing.status === "APPROVED" ||
            existing.status === "WAITLISTED")
        ) {
          // Team is already engaged — skip silently so a batch with mixed
          // states still completes for everyone else.
          continue;
        }
        const app =
          existing
            ? await ctx.prisma.competitionApplication.update({
                where: { id: existing.id },
                data: {
                  status: "INVITED",
                  message: note,
                  reviewNote: null,
                  reviewedAt: null,
                },
              })
            : await ctx.prisma.competitionApplication.create({
                data: {
                  competitionId: competition.id,
                  teamId: team.id,
                  status: "INVITED",
                  message: note,
                },
              });
        results.push(app);
        // Round-50 — only the team captain owns the accept/decline decision,
        // so notify them only. Notifying every team member confused players
        // who weren't the captain: they'd click the notification, land on
        // /apply, and hit "Only the team captain may apply" from the
        // server. The captain still gets the email + in-app ping below.
        await svc.create({
          type: "COMPETITION_INVITE",
          title: `${competition.name} invited ${team.name}`,
          message:
            note ??
            `${organizer.name} invited your team to ${competition.name}. Open the competition page to accept or decline.`,
          recipients: [team.captainId],
          entity: {
            type: "COMPETITION",
            id: competition.id,
            slug: competition.slug,
          },
          groupKey: `comp-invite-${competition.id}-${team.id}`,
        });
        // Queue the email — durable, retryable, and (importantly) does not
        // block the response. The actual SMTP send fires from `after()`
        // below, with /api/cron/drain-emails as a safety-net retry.
        // *.local addresses are auto-marked SKIPPED inside enqueueEmail.
        if (team.captain?.email) {
          await enqueueEmail(ctx.prisma, {
            template: "competition_invite",
            to: team.captain.email,
            payload: {
              captainName: team.captain.name,
              teamName: team.name,
              competitionName: competition.name,
              competitionSlug: competition.slug,
              organizerName: organizer.name,
              personalNote: note,
            },
          });
        }
      }
      // Drain on the side after the response goes out. Failures here don't
      // surface to the caller; the cron picks them up on the next run.
      after(async () => {
        try {
          await drainEmailQueue(ctx.prisma);
        } catch (e) {
          console.warn("[inviteTeamsToCompetition] drain failed:", e);
        }
      });
      // Round-49 — keep `competition.invitedTeamIds` in sync with the new
      // INVITED rows so an INVITE_ONLY comp's apply form / viewerCanApply
      // gate accepts the invited captain. We union, never remove: revoking
      // is a separate flow (decline + admin edit).
      if (results.length) {
        const current = Array.isArray(competition.invitedTeamIds)
          ? (competition.invitedTeamIds as unknown[]).map(String)
          : [];
        const next = Array.from(new Set([...current, ...teams.map((t) => t.id)]));
        if (next.length !== current.length) {
          await ctx.prisma.competition.update({
            where: { id: competition.id },
            data: { invitedTeamIds: next },
          });
        }
      }
      // Re-fetch with the prismaField selection set so downstream resolvers
      // (team, competition, etc.) get whatever the client asked for.
      return ctx.prisma.competitionApplication.findMany({
        ...query,
        where: { id: { in: results.map((r) => r.id) } },
      });
    },
  }),

  withdrawApplication: t.prismaField({
    type: "CompetitionApplication",
    description:
      "Remove an entry from a competition. The team captain (or the solo " +
      "applicant) withdraws their own; the competition organizer or " +
      "SUPER_ADMIN can also remove a confirmed team or cancel an outstanding " +
      "invitation. APPROVED rows free their locked roster slots.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const app = await ctx.prisma.competitionApplication.findUniqueOrThrow({
        where: { id: String(args.id) },
        include: {
          team: {
            select: {
              captainId: true,
              name: true,
              members: { select: { userId: true } },
            },
          },
          competition: {
            select: { id: true, name: true, slug: true, organizerId: true },
          },
        },
      });
      const isCaptain = app.team?.captainId === ctx.viewer.id;
      // Solo (INDIVIDUAL) applications have no team — the applicant owns them
      // and must be able to withdraw their own.
      const isSoloOwner = app.applicantUserId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      // Round-62 — organizers manage their roster: remove a confirmed team or
      // cancel an invite they sent.
      const isOrganizer = app.competition.organizerId === ctx.viewer.id;
      if (!isCaptain && !isSoloOwner && !isAdmin && !isOrganizer) {
        throw new GraphQLError(
          "Only the team captain, the applicant, the organizer, or an admin may remove this entry",
          { extensions: { code: "FORBIDDEN" } },
        );
      }
      if (app.status === "APPROVED" && app.teamId) {
        // Once approved, the team roster is locked — removal must also drop
        // the CompetitionRoster rows so released players can re-apply
        // elsewhere. Solo apps have no teamId and no team roster to clear.
        await ctx.prisma.competitionRoster.deleteMany({
          where: { competitionId: app.competitionId, teamId: app.teamId },
        });
      }
      const updated = await ctx.prisma.competitionApplication.update({
        ...query,
        where: { id: app.id },
        data: { status: "CANCELLED", reviewedAt: new Date() },
      });
      // When the organizer/admin removes someone else's confirmed/applied
      // entry (not a self-withdrawal, and not a never-accepted invite), tell
      // the team so they aren't silently dropped.
      const selfAction = isCaptain || isSoloOwner;
      if (!selfAction && app.status !== "INVITED") {
        const recipients = app.team
          ? Array.from(
              new Set([
                app.team.captainId,
                ...app.team.members.map((m) => m.userId),
              ]),
            )
          : app.applicantUserId
            ? [app.applicantUserId]
            : [];
        if (recipients.length > 0) {
          const subjectName =
            app.team?.name ?? (await getApplicantName(ctx, app.applicantUserId));
          await new NotificationService(ctx.prisma).create({
            type: "APPLICATION_REJECTED",
            title: `Removed: ${subjectName} from ${app.competition.name}`,
            message: "The organizer removed your team from this competition.",
            recipients,
            entity: {
              type: "COMPETITION",
              id: app.competition.id,
              slug: app.competition.slug,
            },
            groupKey: `app-removed-${app.id}`,
          });
        }
      }
      return updated;
    },
  }),
}));
