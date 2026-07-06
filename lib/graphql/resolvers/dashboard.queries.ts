import { builder } from "../builder";

builder.queryFields((t) => ({
  viewerNextMatch: t.prismaField({
    type: "Match",
    nullable: true,
    description:
      "The viewer's next SCHEDULED match — where they captain either side, or organize the competition. Null if none.",
    resolve: async (query, _root, _args, ctx) => {
      if (!ctx.viewer) return null;
      return ctx.prisma.match.findFirst({
        ...query,
        where: {
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          ...ACTIVE_COMPETITION,
          OR: viewerMatchOR(ctx.viewer.id),
        },
        orderBy: { scheduledAt: "asc" },
      });
    },
  }),

  viewerTodayMatch: t.prismaField({
    type: "Match",
    nullable: true,
    description:
      "Round-47 — the viewer's match scheduled for TODAY (server-local day window). Same scope as viewerNextMatch but date-bounded so the dashboard's 'Today's Match' card actually says what it claims.",
    resolve: async (query, _root, _args, ctx) => {
      if (!ctx.viewer) return null;
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return ctx.prisma.match.findFirst({
        ...query,
        where: {
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          scheduledAt: { gte: start, lte: end },
          ...ACTIVE_COMPETITION,
          OR: viewerMatchOR(ctx.viewer.id),
        },
        orderBy: { scheduledAt: "asc" },
      });
    },
  }),
}));

// Only matches in an ONGOING competition are real upcoming games. Cancelled
// (and any non-active) competitions leave their matches behind as SCHEDULED
// orphans — without this filter they'd keep surfacing on the dashboard's
// "Today's Match" / next-match cards even though the competition is gone.
const ACTIVE_COMPETITION = {
  matchday: { is: { competition: { is: { status: "ONGOING" as const } } } },
};

// Shared OR clause for "matches the viewer is involved in" — captain on
// either side, or organizer of the competition. Extracted so viewer*Match
// queries can't drift apart.
function viewerMatchOR(viewerId: string) {
  return [
    { homeTeam: { is: { captainId: viewerId } } },
    { awayTeam: { is: { captainId: viewerId } } },
    {
      matchday: {
        is: { competition: { is: { organizerId: viewerId } } },
      },
    },
  ];
}
