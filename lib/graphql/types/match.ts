import { builder } from "../builder";
import { MatchStatusEnum } from "./enums";
import { GameBlockTypeEnum } from "./structure";

builder.prismaObject("Matchday", {
  fields: (t) => ({
    id: t.exposeID("id"),
    number: t.exposeInt("number"),
    label: t.exposeString("label", { nullable: true }),
    scheduledDate: t.expose("scheduledDate", {
      type: "DateTime",
      nullable: true,
    }),
    isGenerated: t.exposeBoolean("isGenerated"),
    competition: t.relation("competition"),
    matches: t.relation("matches"),
  }),
});

builder.prismaObject("Match", {
  fields: (t) => ({
    id: t.exposeID("id"),
    status: t.expose("status", { type: MatchStatusEnum }),
    matchday: t.relation("matchday"),
    venue: t.relation("venue", { nullable: true }),
    homeTeam: t.relation("homeTeam", { nullable: true }),
    awayTeam: t.relation("awayTeam", { nullable: true }),
    scheduledAt: t.expose("scheduledAt", { type: "DateTime", nullable: true }),
    startedAt: t.expose("startedAt", { type: "DateTime", nullable: true }),
    completedAt: t.expose("completedAt", {
      type: "DateTime",
      nullable: true,
    }),
    homeScore: t.exposeInt("homeScore", { nullable: true }),
    awayScore: t.exposeInt("awayScore", { nullable: true }),
    notes: t.exposeString("notes", { nullable: true }),
    frames: t.relation("frames", {
      query: () => ({ orderBy: { frameNumber: "asc" } }),
    }),
    participants: t.relation("participants"),
    homeLineupSubmittedAt: t.expose("homeLineupSubmittedAt", {
      type: "DateTime",
      nullable: true,
    }),
    awayLineupSubmittedAt: t.expose("awayLineupSubmittedAt", {
      type: "DateTime",
      nullable: true,
    }),
    bothLineupsSubmitted: t.boolean({
      resolve: (m) =>
        !!m.homeLineupSubmittedAt && !!m.awayLineupSubmittedAt,
    }),
  }),
});

builder.prismaObject("MatchFrame", {
  fields: (t) => ({
    id: t.exposeID("id"),
    frameNumber: t.exposeInt("frameNumber"),
    blockType: t.expose("blockType", {
      type: GameBlockTypeEnum,
      nullable: true,
    }),
    homeWon: t.exposeBoolean("homeWon", { nullable: true }),
    homePlayer: t.exposeString("homePlayer", { nullable: true }),
    awayPlayer: t.exposeString("awayPlayer", { nullable: true }),
    homePlayerRef: t.relation("homePlayerRef", { nullable: true }),
    awayPlayerRef: t.relation("awayPlayerRef", { nullable: true }),
  }),
});

builder.prismaObject("MatchParticipant", {
  fields: (t) => ({
    id: t.exposeID("id"),
    user: t.relation("user"),
    framesWon: t.exposeInt("framesWon"),
    framesPlayed: t.exposeInt("framesPlayed"),
  }),
});

export const RecordFrameInput = builder.inputType("RecordFrameInput", {
  fields: (t) => ({
    matchId: t.id({ required: true }),
    frameNumber: t.int({ required: true }),
    homeWon: t.boolean({ required: true }),
    homePlayer: t.string(),
    awayPlayer: t.string(),
  }),
});

export const SubmitMatchResultInput = builder.inputType(
  "SubmitMatchResultInput",
  {
    fields: (t) => ({
      matchId: t.id({ required: true }),
      homeScore: t.int({ required: true }),
      awayScore: t.int({ required: true }),
    }),
  },
);

export const LineupSlotInput = builder.inputType("LineupSlotInput", {
  fields: (t) => ({
    frameNumber: t.int({ required: true }),
    // Single player for SINGLES; for DOUBLES/SCOTCH_DOUBLES the second slot
    // is passed via partnerPlayerId.
    playerId: t.id({ required: true }),
    partnerPlayerId: t.id(),
  }),
});

export const SubmitLineupInput = builder.inputType("SubmitLineupInput", {
  fields: (t) => ({
    matchId: t.id({ required: true }),
    slots: t.field({ type: [LineupSlotInput], required: true }),
  }),
});
