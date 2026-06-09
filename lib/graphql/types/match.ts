import { builder } from "../builder";
import { MatchStatusEnum } from "./enums";
import { GameBlockTypeEnum } from "./structure";
import {
  MatchCompletionMode,
  MatchWinType,
  RescheduleRequestStatus,
} from "@/lib/generated/prisma/enums";

const MatchWinTypeEnum = builder.enumType(MatchWinType, {
  name: "MatchWinType",
});

const MatchCompletionModeEnum = builder.enumType(MatchCompletionMode, {
  name: "MatchCompletionMode",
});

const RescheduleRequestStatusEnum = builder.enumType(RescheduleRequestStatus, {
  name: "RescheduleRequestStatus",
});

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
    completedBy: t.relation("completedBy", { nullable: true }),
    completionMode: t.expose("completionMode", {
      type: MatchCompletionModeEnum,
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
    lineupEditRequestedAt: t.expose("lineupEditRequestedAt", {
      type: "DateTime",
      nullable: true,
    }),
    lineupEditRequestedById: t.exposeID("lineupEditRequestedById", {
      nullable: true,
    }),
    lineupEditRequestedSide: t.exposeString("lineupEditRequestedSide", {
      nullable: true,
    }),
    // Round-20 — no-show bookkeeping.
    winType: t.expose("winType", { type: MatchWinTypeEnum }),
    forfeitTeamId: t.exposeID("forfeitTeamId", { nullable: true }),
    forfeitReason: t.exposeString("forfeitReason", { nullable: true }),
    rescheduleRequests: t.relation("rescheduleRequests", {
      query: () => ({ orderBy: { createdAt: "desc" } }),
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
    isWalkover: t.exposeBoolean("isWalkover"),
    breakAndRun: t.exposeBoolean("breakAndRun"),
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
    // Round-47 — Break & Run flag for the winning side. Captains tick
    // this when the winner cleared the rack on their break without the
    // opponent taking a shot. Feeds the Figma MVP formula.
    breakAndRun: t.boolean(),
  }),
});

// Round-20 — reschedule requests.
builder.prismaObject("MatchRescheduleRequest", {
  fields: (t) => ({
    id: t.exposeID("id"),
    match: t.relation("match"),
    requestedBy: t.relation("requestedBy"),
    proposedDate: t.expose("proposedDate", { type: "DateTime" }),
    reason: t.exposeString("reason", { nullable: true }),
    status: t.expose("status", { type: RescheduleRequestStatusEnum }),
    reviewedBy: t.relation("reviewedBy", { nullable: true }),
    reviewedAt: t.expose("reviewedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
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
