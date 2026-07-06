import { builder } from "../builder";
import { ensure, requireUser } from "@/lib/casl/guard";

/**
 * Round-63 — dry-run season-schedule preview.
 *
 * `previewMatchdays` computes the exact schedule generateMatchdays would
 * persist (same shared service), but returns it as lightweight, un-persisted
 * objects so the organizer can review matchdays + venue assignments — and tune
 * the games-per-venue cap — before confirming. Confirm then calls
 * generateMatchdays with the same cap.
 */

type PreviewMatch = {
  homeTeamId: string;
  homeTeamName: string;
  homeTeamLogoUrl: string | null;
  awayTeamId: string;
  awayTeamName: string;
  awayTeamLogoUrl: string | null;
  venueId: string | null;
  venueName: string | null;
  swapped: boolean;
};

type PreviewByeTeam = {
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
};

type PreviewMatchday = {
  number: number;
  label: string;
  scheduledDate: string;
  matches: PreviewMatch[];
  byes: PreviewByeTeam[];
};

const SchedulePreviewMatch = builder
  .objectRef<PreviewMatch>("SchedulePreviewMatch")
  .implement({
    description: "One match in a dry-run season-schedule preview (not saved).",
    fields: (t) => ({
      homeTeamId: t.exposeID("homeTeamId"),
      homeTeamName: t.exposeString("homeTeamName"),
      homeTeamLogoUrl: t.exposeString("homeTeamLogoUrl", { nullable: true }),
      awayTeamId: t.exposeID("awayTeamId"),
      awayTeamName: t.exposeString("awayTeamName"),
      awayTeamLogoUrl: t.exposeString("awayTeamLogoUrl", { nullable: true }),
      venueId: t.exposeID("venueId", { nullable: true }),
      venueName: t.exposeString("venueName", { nullable: true }),
      // True when home/away was flipped to keep the venue under the cap.
      swapped: t.exposeBoolean("swapped"),
    }),
  });

const SchedulePreviewByeTeam = builder
  .objectRef<PreviewByeTeam>("SchedulePreviewByeTeam")
  .implement({
    description: "A team sitting out a matchday (bye) in the preview.",
    fields: (t) => ({
      teamId: t.exposeID("teamId"),
      teamName: t.exposeString("teamName"),
      teamLogoUrl: t.exposeString("teamLogoUrl", { nullable: true }),
    }),
  });

const SchedulePreviewMatchday = builder
  .objectRef<PreviewMatchday>("SchedulePreviewMatchday")
  .implement({
    description: "A matchday in a dry-run season-schedule preview.",
    fields: (t) => ({
      number: t.exposeInt("number"),
      label: t.exposeString("label"),
      scheduledDate: t.field({
        type: "DateTime",
        nullable: true,
        resolve: (d) => (d.scheduledDate ? new Date(d.scheduledDate) : null),
      }),
      matches: t.field({
        type: [SchedulePreviewMatch],
        resolve: (d) => d.matches,
      }),
      byes: t.field({
        type: [SchedulePreviewByeTeam],
        resolve: (d) => d.byes,
      }),
    }),
  });

builder.queryFields((t) => ({
  previewMatchdays: t.field({
    type: [SchedulePreviewMatchday],
    description:
      "Dry-run the round-robin season schedule from APPROVED teams WITHOUT persisting it. Powers the pre-generate preview; pass maxGamesPerVenuePerMatchday to see the effect of the venue cap. Empty when there are fewer than 2 approved teams.",
    args: {
      id: t.arg.id({ required: true }),
      maxGamesPerVenuePerMatchday: t.arg.int(),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const competition = await ctx.prisma.competition.findUniqueOrThrow({
        where: { id: String(args.id) },
        include: { applications: { where: { status: "APPROVED" } } },
      });
      ensure(ctx.ability, "update", {
        ...competition,
        __caslSubjectType__: "Competition",
      });
      const teamIds = competition.applications
        .map((a) => a.teamId)
        .filter((id): id is string => Boolean(id));
      if (teamIds.length < 2) return [];

      const { computeSeasonSchedule, parseWeekdaySchedule } = await import(
        "@/lib/services/season-schedule.service"
      );
      const teams = await ctx.prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, name: true, logoUrl: true, homeVenueId: true },
      });
      const teamById = new Map(teams.map((t) => [t.id, t]));
      const useCentral = competition.matchVenueMode === "CENTRAL_VENUE";
      const homeVenueByTeam = new Map<string, string | null>(
        teams.map((t) => [
          t.id,
          useCentral
            ? competition.centralVenueId ?? null
            : t.homeVenueId ?? null,
        ]),
      );
      const cap =
        args.maxGamesPerVenuePerMatchday ??
        competition.maxGamesPerVenuePerMatchday ??
        null;

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

      const venueIds = Array.from(
        new Set(
          schedule.flatMap((d) =>
            d.matches
              .map((m) => m.venueId)
              .filter((v): v is string => Boolean(v)),
          ),
        ),
      );
      const venues = venueIds.length
        ? await ctx.prisma.venue.findMany({
            where: { id: { in: venueIds } },
            select: { id: true, name: true },
          })
        : [];
      const venueName = new Map(venues.map((v) => [v.id, v.name]));

      return schedule.map((d) => ({
        number: d.number,
        label: d.label,
        scheduledDate: d.scheduledDate,
        byes: d.byeTeamIds.map((id) => ({
          teamId: id,
          teamName: teamById.get(id)?.name ?? "—",
          teamLogoUrl: teamById.get(id)?.logoUrl ?? null,
        })),
        matches: d.matches.map((m) => ({
          homeTeamId: m.home,
          homeTeamName: teamById.get(m.home)?.name ?? "—",
          homeTeamLogoUrl: teamById.get(m.home)?.logoUrl ?? null,
          awayTeamId: m.away,
          awayTeamName: teamById.get(m.away)?.name ?? "—",
          awayTeamLogoUrl: teamById.get(m.away)?.logoUrl ?? null,
          venueId: m.venueId,
          venueName: m.venueId ? venueName.get(m.venueId) ?? null : null,
          swapped: m.swapped,
        })),
      }));
    },
  }),
}));
