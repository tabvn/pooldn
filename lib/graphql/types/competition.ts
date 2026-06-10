import { builder } from "../builder";
import {
  ApplicationModeEnum,
  ApplicationStatusEnum,
  CompetitionFormatEnum,
  CompetitionStatusEnum,
  CompetitionTypeEnum,
  GameTypeEnum,
  MatchVenueModeEnum,
  SchedulingTypeEnum,
} from "./enums";
export { SchedulingTypeEnum };
import { MatchFormatBlockInput } from "./structure";

/**
 * Round-48 (wizard) — one row of the Figma "Scheduling Type → Weekly Rounds"
 * builder. weekday = 0 (Sun) … 6 (Sat) matching JS Date.getDay(); time is a
 * 24h "HH:mm" string. Persisted as Json on Competition.weekdaySchedule.
 */
export type WeekdaySlotShape = { weekday: number; time: string };

export const WeekdaySlot = builder
  .objectRef<WeekdaySlotShape>("WeekdaySlot")
  .implement({
    fields: (t) => ({
      weekday: t.exposeInt("weekday"),
      time: t.exposeString("time"),
    }),
  });

export const WeekdaySlotInput = builder.inputType("WeekdaySlotInput", {
  fields: (t) => ({
    weekday: t.int({ required: true }),
    time: t.string({ required: true }),
  }),
});

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
    requiresHomeVenue: t.exposeBoolean("requiresHomeVenue"),
    // Round-48 (wizard) — Figma "How Participants Apply" + Schedule fields.
    applicationMode: t.expose("applicationMode", { type: ApplicationModeEnum }),
    invitedTeamIds: t.field({
      type: ["ID"],
      nullable: true,
      resolve: (c) => {
        const v = c.invitedTeamIds as unknown;
        if (!Array.isArray(v)) return null;
        return v.map((x) => String(x));
      },
    }),
    matchVenueMode: t.expose("matchVenueMode", { type: MatchVenueModeEnum }),
    centralVenue: t.relation("centralVenue", { nullable: true }),
    gamesPerOpponent: t.exposeInt("gamesPerOpponent"),
    // Stored as JSON of `{weekday: 0–6, time: "HH:mm"}`. We expose as a list
    // of WeekdaySlot via a JSON-safe shape consumers can map without
    // re-validation.
    weekdaySchedule: t.field({
      type: [WeekdaySlot],
      nullable: true,
      resolve: (c) => {
        const v = c.weekdaySchedule as unknown;
        if (!Array.isArray(v)) return null;
        return v
          .filter((x): x is { weekday: number; time: string } => {
            return (
              typeof x === "object" &&
              x !== null &&
              "weekday" in x &&
              "time" in x &&
              typeof (x as { weekday: unknown }).weekday === "number" &&
              typeof (x as { time: unknown }).time === "string"
            );
          })
          .map((x) => ({ weekday: x.weekday, time: x.time }));
      },
    }),
    maxGamesPerVenuePerMatchday: t.exposeInt(
      "maxGamesPerVenuePerMatchday",
      { nullable: true },
    ),
    /**
     * Round-48 (wizard) — server-computed gate the apply CTA reads. True iff
     *  - viewer is signed in and not the read-only VIEWER role,
     *  - competition.status === OPEN_FOR_APPLICATIONS,
     *  - AND (applicationMode === OPEN OR the viewer captains a team in
     *    invitedTeamIds — the INVITE_ONLY pre-list).
     * Single source of truth so the UI gate and the applyToCompetition
     * server check can never drift.
     */
    viewerCanApply: t.boolean({
      resolve: async (c, _args, ctx) => {
        if (!ctx.viewer) return false;
        if (ctx.viewer.role === "VIEWER") return false;
        if (c.status !== "OPEN_FOR_APPLICATIONS") return false;
        if (c.applicationMode === "OPEN") return true;
        // INVITE_ONLY — does the viewer captain any of the invited teams?
        const invited = Array.isArray(c.invitedTeamIds)
          ? (c.invitedTeamIds as unknown[]).map(String)
          : [];
        if (invited.length === 0) return false;
        const match = await ctx.prisma.team.findFirst({
          where: {
            id: { in: invited },
            captainId: ctx.viewer.id,
          },
          select: { id: true },
        });
        return !!match;
      },
    }),
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
    // Round-48 — per-competition Roster Captain (set only when the Team
    // Captain isn't in this application's roster). The match flow allows
    // this user to act with the same authority as the Team Captain.
    rosterCaptain: t.relation("rosterCaptain", { nullable: true }),
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
      requiresHomeVenue: t.boolean({ defaultValue: false }),
      // Round-48 (wizard) — Figma fields.
      applicationMode: t.field({ type: ApplicationModeEnum }),
      invitedTeamIds: t.idList(),
      matchVenueMode: t.field({ type: MatchVenueModeEnum }),
      centralVenueId: t.id(),
      gamesPerOpponent: t.int({ defaultValue: 1 }),
      weekdaySchedule: t.field({ type: [WeekdaySlotInput] }),
      maxGamesPerVenuePerMatchday: t.int(),
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
      // Round-48 — when the Team Captain isn't in playerUserIds, they MUST
      // nominate one of the roster players to be the Roster Captain. The
      // resolver enforces: rosterCaptainUserId ∈ playerUserIds and is
      // required iff captain ∉ playerUserIds.
      rosterCaptainUserId: t.id(),
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
