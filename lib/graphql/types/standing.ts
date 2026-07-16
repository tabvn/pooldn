import { builder } from "../builder";

builder.prismaObject("Standing", {
  fields: (t) => ({
    id: t.exposeID("id"),
    position: t.exposeInt("position", { nullable: true }),
    team: t.relation("team"),
    competition: t.relation("competition"),
    played: t.exposeInt("played"),
    won: t.exposeInt("won"),
    drawn: t.exposeInt("drawn"),
    lost: t.exposeInt("lost"),
    pointsFor: t.exposeInt("pointsFor"),
    pointsAgainst: t.exposeInt("pointsAgainst"),
    pointDiff: t.exposeInt("pointDiff"),
    points: t.exposeInt("points"),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
    /**
     * Recent form — the team's last up-to-5 completed match results in this
     * competition, oldest → newest (so the newest sits on the right). Each
     * entry is "W" | "D" | "L". Fewer than 5 entries means the team hasn't
     * played 5 games yet; the UI pads the remaining slots with empty dots.
     */
    form: t.stringList({
      resolve: async (s, _args, ctx) => {
        const matches = await ctx.prisma.match.findMany({
          where: {
            status: "COMPLETED",
            matchday: { competitionId: s.competitionId },
            OR: [{ homeTeamId: s.teamId }, { awayTeamId: s.teamId }],
            homeScore: { not: null },
            awayScore: { not: null },
          },
          orderBy: [
            { completedAt: "desc" },
            { scheduledAt: "desc" },
            { updatedAt: "desc" },
          ],
          take: 5,
          select: {
            homeTeamId: true,
            homeScore: true,
            awayScore: true,
          },
        });
        // findMany returns newest-first; reverse to chronological order.
        return matches.reverse().map((m) => {
          const isHome = m.homeTeamId === s.teamId;
          const own = isHome ? m.homeScore! : m.awayScore!;
          const opp = isHome ? m.awayScore! : m.homeScore!;
          if (own > opp) return "W";
          if (own < opp) return "L";
          return "D";
        });
      },
    }),
  }),
});

builder.prismaObject("PlayerCompStat", {
  fields: (t) => ({
    id: t.exposeID("id"),
    user: t.relation("user"),
    competition: t.relation("competition"),
    matchesPlayed: t.exposeInt("matchesPlayed"),
    framesWon: t.exposeInt("framesWon"),
    framesPlayed: t.exposeInt("framesPlayed"),
    singlesPlayed: t.exposeInt("singlesPlayed"),
    singlesWon: t.exposeInt("singlesWon"),
    doublesPlayed: t.exposeInt("doublesPlayed"),
    doublesWon: t.exposeInt("doublesWon"),
    brWon: t.exposeInt("brWon"),
    mvpScore: t.exposeInt("mvpScore"),
    isMvp: t.exposeBoolean("isMvp"),
    winRate: t.float({
      nullable: true,
      resolve: (s) =>
        s.framesPlayed > 0 ? s.framesWon / s.framesPlayed : null,
    }),
  }),
});
