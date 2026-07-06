import { accessibleBy } from "@casl/prisma";
import { builder } from "../builder";

builder.queryFields((t) => ({
  match: t.prismaField({
    type: "Match",
    nullable: true,
    description: "Look up a single match by id.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      const m = await ctx.prisma.match.findUnique({
        ...query,
        where: { id: String(args.id) },
        // matchdayId drives the competition read gate below.
      });
      if (!m) return null;
      // Visibility piggybacks on Competition visibility. The bare
      // `can("read", "Competition")` form skips the isPublic/status
      // conditions (no instance to test), so it let anyone read matches of
      // a draft/private competition. Gate on the concrete competition row
      // via accessibleBy instead.
      const readable = await ctx.prisma.competition.findFirst({
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Competition"),
            { matchdays: { some: { id: m.matchdayId } } },
          ],
        },
        select: { id: true },
      });
      if (!readable) return null;
      return m;
    },
  }),

  competitionRoster: t.prismaField({
    type: ["User"],
    description:
      "Players a team locked into a competition's roster when it applied. Lineup selection is limited to these players. Falls back to the full team membership when no roster was captured (legacy data).",
    args: {
      competitionId: t.arg.id({ required: true }),
      teamId: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const competitionId = String(args.competitionId);
      const teamId = String(args.teamId);
      // Read-gate on the competition's visibility.
      const readable = await ctx.prisma.competition.findFirst({
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Competition"),
            { id: competitionId },
          ],
        },
        select: { id: true },
      });
      if (!readable) return [];
      const rosters = await ctx.prisma.competitionRoster.findMany({
        where: { competitionId, teamId },
        select: { userId: true },
      });
      let ids = rosters.map((r) => r.userId);
      if (ids.length === 0) {
        // Legacy fallback: no locked roster → allow the full team membership.
        const team = await ctx.prisma.team.findUnique({
          where: { id: teamId },
          select: { members: { select: { userId: true } } },
        });
        ids = team?.members.map((m) => m.userId) ?? [];
      }
      if (ids.length === 0) return [];
      return ctx.prisma.user.findMany({
        ...query,
        where: { id: { in: ids } },
        orderBy: { name: "asc" },
      });
    },
  }),
}));
