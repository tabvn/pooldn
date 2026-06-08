import { builder } from "../builder";

builder.queryFields((t) => ({
  viewerNextMatch: t.prismaField({
    type: "Match",
    nullable: true,
    description:
      "The viewer's next SCHEDULED match — where they captain either side, or organize the competition. Null if none.",
    resolve: async (query, _root, _args, ctx) => {
      if (!ctx.viewer) return null;
      // A captain's next match: home or away team captained by viewer.
      // An organizer's next match: in a competition they organize.
      return ctx.prisma.match.findFirst({
        ...query,
        where: {
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          OR: [
            { homeTeam: { is: { captainId: ctx.viewer.id } } },
            { awayTeam: { is: { captainId: ctx.viewer.id } } },
            {
              matchday: {
                is: { competition: { is: { organizerId: ctx.viewer.id } } },
              },
            },
          ],
        },
        orderBy: { scheduledAt: "asc" },
      });
    },
  }),
}));
