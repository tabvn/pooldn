import { builder } from "../builder";
import {
  ApplicationStatusEnum,
  CompetitionFormatEnum,
  CompetitionStatusEnum,
  CompetitionTypeEnum,
  GameTypeEnum,
  SchedulingTypeEnum,
} from "./enums";
export { SchedulingTypeEnum };
import { MatchFormatBlockInput } from "./structure";

builder.prismaObject("Competition", {
  fields: (t) => ({
    id: t.exposeID("id"),
    slug: t.exposeString("slug"),
    name: t.exposeString("name"),
    description: t.exposeString("description", { nullable: true }),
    bannerUrl: t.exposeString("bannerUrl", { nullable: true }),
    rulesUrl: t.exposeString("rulesUrl", { nullable: true }),
    status: t.expose("status", { type: CompetitionStatusEnum }),
    type: t.expose("type", { type: CompetitionTypeEnum }),
    format: t.expose("format", { type: CompetitionFormatEnum }),
    gameType: t.expose("gameType", { type: GameTypeEnum }),
    organizer: t.relation("organizer"),
    city: t.relation("city", { nullable: true }),
    maxTeams: t.exposeInt("maxTeams", { nullable: true }),
    minTeams: t.exposeInt("minTeams"),
    maxPlayersPerTeam: t.exposeInt("maxPlayersPerTeam", { nullable: true }),
    minPlayersPerTeam: t.exposeInt("minPlayersPerTeam"),
    raceToFrames: t.exposeInt("raceToFrames"),
    framesPerMatchday: t.exposeInt("framesPerMatchday", { nullable: true }),
    applicationDeadline: t.expose("applicationDeadline", {
      type: "DateTime",
      nullable: true,
    }),
    startDate: t.expose("startDate", { type: "DateTime", nullable: true }),
    endDate: t.expose("endDate", { type: "DateTime", nullable: true }),
    schedulingType: t.expose("schedulingType", { type: SchedulingTypeEnum }),
    prizePool: t.string({
      nullable: true,
      resolve: (c) => (c.prizePool ? c.prizePool.toString() : null),
    }),
    currency: t.exposeString("currency"),
    pointsWin: t.exposeInt("pointsWin"),
    pointsDraw: t.exposeInt("pointsDraw"),
    pointsLoss: t.exposeInt("pointsLoss"),
    isPublic: t.exposeBoolean("isPublic"),
    breakAndRunRule: t.exposeBoolean("breakAndRunRule"),
    blocks: t.relation("blocks", {
      query: () => ({ orderBy: { order: "asc" } }),
    }),
    applications: t.relation("applications", {
      query: () => ({ orderBy: { submittedAt: "desc" } }),
    }),
    matchdays: t.relation("matchdays", {
      query: () => ({ orderBy: { number: "asc" } }),
    }),
    standings: t.relation("standings", {
      query: () => ({ orderBy: [{ position: "asc" }, { points: "desc" }] }),
    }),
    playerStats: t.relation("playerStats"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

builder.prismaObject("CompetitionApplication", {
  fields: (t) => ({
    id: t.exposeID("id"),
    competition: t.relation("competition"),
    team: t.relation("team"),
    status: t.expose("status", { type: ApplicationStatusEnum }),
    message: t.exposeString("message", { nullable: true }),
    reviewNote: t.exposeString("reviewNote", { nullable: true }),
    submittedAt: t.expose("submittedAt", { type: "DateTime" }),
    reviewedAt: t.expose("reviewedAt", { type: "DateTime", nullable: true }),
    applicationPlayers: t.relation("applicationPlayers"),
  }),
});

builder.prismaObject("ApplicationPlayer", {
  fields: (t) => ({
    id: t.exposeID("id"),
    user: t.relation("user"),
    name: t.exposeString("name"),
    role: t.exposeString("role", { nullable: true }),
  }),
});

export const CompetitionFilters = builder.inputType("CompetitionFilters", {
  fields: (t) => ({
    status: t.field({ type: CompetitionStatusEnum }),
    cityId: t.id(),
    gameType: t.field({ type: GameTypeEnum }),
    search: t.string(),
  }),
});

export const CreateCompetitionInput = builder.inputType(
  "CreateCompetitionInput",
  {
    fields: (t) => ({
      name: t.string({ required: true }),
      slug: t.string({ required: true }),
      description: t.string(),
      rulesUrl: t.string(),
      cityId: t.id(),
      type: t.field({ type: CompetitionTypeEnum }),
      format: t.field({ type: CompetitionFormatEnum }),
      gameType: t.field({ type: GameTypeEnum }),
      maxTeams: t.int(),
      minTeams: t.int({ defaultValue: 2 }),
      maxPlayersPerTeam: t.int(),
      minPlayersPerTeam: t.int({ defaultValue: 1 }),
      raceToFrames: t.int({ defaultValue: 5 }),
      startDate: t.field({ type: "DateTime" }),
      endDate: t.field({ type: "DateTime" }),
      prizePool: t.string(),
      currency: t.string({ defaultValue: "VND" }),
      schedulingType: t.field({ type: SchedulingTypeEnum }),
      breakAndRunRule: t.boolean({ defaultValue: false }),
      blocks: t.field({ type: [MatchFormatBlockInput] }),
    }),
  },
);

export const ApplyToCompetitionInput = builder.inputType(
  "ApplyToCompetitionInput",
  {
    fields: (t) => ({
      competitionId: t.id({ required: true }),
      teamId: t.id({ required: true }),
      message: t.string(),
      playerUserIds: t.idList({ defaultValue: [] }),
    }),
  },
);

export const ReviewApplicationInput = builder.inputType(
  "ReviewApplicationInput",
  {
    fields: (t) => ({
      applicationId: t.id({ required: true }),
      approve: t.boolean({ required: true }),
      reviewNote: t.string(),
    }),
  },
);
