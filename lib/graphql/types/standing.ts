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
    isMvp: t.exposeBoolean("isMvp"),
  }),
});
