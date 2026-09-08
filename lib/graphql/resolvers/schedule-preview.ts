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
      "Dry-run the round-robin season schedule WITHOUT persisting it. Powers the pre-generate preview. Entrants are APPROVED teams, or APPROVED players on an INDIVIDUAL (Singles) competition. Pass maxGamesPerVenuePerMatchday to see the effect of the venue cap (team formats only). Empty when there are fewer than 2 approved entrants.",
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
      // Round-78 — entrants are teams, or PLAYERS on a Singles competition.
      // This used to read `a.teamId` unconditionally, so every Singles
      // application (teamId null, applicantUserId set) was filtered out, the
      // preview returned [], and the panel's Confirm button — gated on
      // `days.length === 0` — stayed permanently disabled. A Singles
      // round-robin league could not be started at all.
      const isIndividual = competition.type === "INDIVIDUAL";
      const entrantIds = competition.applications
        .map((a) => (isIndividual ? a.applicantUserId : a.teamId))
        .filter((id): id is string => Boolean(id));
      if (entrantIds.length < 2) return [];

      const { computeSeasonSchedule, parseWeekdaySchedule } = await import(
        "@/lib/services/season-schedule.service"
      );
      const useCentral = competition.matchVenueMode === "CENTRAL_VENUE";
      // One shape for both: id → display name + avatar/logo. Singles players
      // have no home venue, so every match sits at the central venue (or
      // nowhere, for Free Location) exactly like generateMatchdays does.
      const entrants = isIndividual
        ? (
            await ctx.prisma.user.findMany({
              where: { id: { in: entrantIds } },
              select: { id: true, name: true, avatarUrl: true },
            })
          ).map((u) => ({
            id: u.id,
            name: u.name,
            logoUrl: u.avatarUrl,
            homeVenueId: null as string | null,
          }))
        : await ctx.prisma.team.findMany({
            where: { id: { in: entrantIds } },
            select: { id: true, name: true, logoUrl: true, homeVenueId: true },
          });
      const teamById = new Map(entrants.map((t) => [t.id, t]));
      const homeVenueByTeam = new Map<string, string | null>(
        entrants.map((t) => [
          t.id,
          useCentral
            ? competition.centralVenueId ?? null
            : t.homeVenueId ?? null,
        ]),
      );
      // The venue cap only means anything when entrants have their own home
      // venues to collide over — Singles has none, so it's always unlimited.
      const cap = isIndividual
        ? null
        : args.maxGamesPerVenuePerMatchday ??
          competition.maxGamesPerVenuePerMatchday ??
          null;

      const schedule = computeSeasonSchedule({
        teamIds: entrantIds,
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
