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

// Round-60 — derived per-block lineup state for the match-flow UI.
type BlockStateShape = {
  blockOrder: number;
  blockType: string;
  homeSubmittedAt: Date | null;
  homeSubmittedById: string | null;
  homeProofImageUrls: string[];
  awaySubmittedAt: Date | null;
  awaySubmittedById: string | null;
  awayProofImageUrls: string[];
  published: boolean;
  fullyDecided: boolean;
  locked: boolean;
  isCurrentActive: boolean;
};

type PrismaLike = import("@/lib/generated/prisma/client").PrismaClient;

/**
 * Computes the per-block lineup state for a team match: which side submitted
 * each block, whether it's published (both sides in) and fully decided, and
 * which block is currently active (lowest not-yet-decided). Back-compat: a
 * match with the legacy whole-match lineup timestamps but no per-block rows
 * is treated as "all blocks published".
 */
async function computeBlockStates(
  prisma: PrismaLike,
  matchId: string,
): Promise<BlockStateShape[]> {
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      status: true,
      homeLineupSubmittedAt: true,
      awayLineupSubmittedAt: true,
      matchday: {
        select: {
          competition: {
            select: {
              blocks: {
                orderBy: { order: "asc" },
                select: { order: true, type: true },
              },
            },
          },
        },
      },
      frames: { select: { blockOrder: true, homeWon: true } },
      blockLineups: {
        select: {
          side: true,
          blockOrder: true,
          submittedAt: true,
          submittedById: true,
          proofImageUrls: true,
        },
      },
    },
  });
  if (!m) return [];
  const blocks = m.matchday.competition.blocks;
  // Back-compat: a finished match (legacy seed data may have frames without
  // blockOrder and no per-block rows) is treated as fully published/decided;
  // likewise a match carrying only the old whole-match lineup timestamps.
  const isCompleted = m.status === "COMPLETED";
  const legacyFallback =
    m.blockLineups.length === 0 &&
    !!m.homeLineupSubmittedAt &&
    !!m.awayLineupSubmittedAt;

  const decidedByOrder = new Map<number, boolean>();
  for (const b of blocks) {
    const fs = m.frames.filter((f) => f.blockOrder === b.order);
    decidedByOrder.set(b.order, fs.length > 0 && fs.every((f) => f.homeWon !== null));
  }
  const currentActive = isCompleted
    ? null
    : blocks.find((b) => !decidedByOrder.get(b.order))?.order ?? null;

  return blocks.map((b) => {
    const home = m.blockLineups.find(
      (r) => r.blockOrder === b.order && r.side === "HOME",
    );
    const away = m.blockLineups.find(
      (r) => r.blockOrder === b.order && r.side === "AWAY",
    );
    const published = isCompleted || legacyFallback || (!!home && !!away);
    return {
      blockOrder: b.order,
      blockType: b.type as string,
      homeSubmittedAt: home?.submittedAt ?? (legacyFallback ? m.homeLineupSubmittedAt : null),
      homeSubmittedById: home?.submittedById ?? null,
      homeProofImageUrls: home?.proofImageUrls ?? [],
      awaySubmittedAt: away?.submittedAt ?? (legacyFallback ? m.awayLineupSubmittedAt : null),
      awaySubmittedById: away?.submittedById ?? null,
      awayProofImageUrls: away?.proofImageUrls ?? [],
      published,
      fullyDecided: isCompleted || (decidedByOrder.get(b.order) ?? false),
      locked: published,
      isCurrentActive: b.order === currentActive,
    };
  });
}

const MatchBlockState = builder
  .objectRef<BlockStateShape>("MatchBlockState")
  .implement({
    fields: (t) => ({
      blockOrder: t.exposeInt("blockOrder"),
      blockType: t.exposeString("blockType"),
      homeSubmittedAt: t.expose("homeSubmittedAt", { type: "DateTime", nullable: true }),
      homeSubmittedById: t.exposeID("homeSubmittedById", { nullable: true }),
      homeProofImageUrls: t.exposeStringList("homeProofImageUrls"),
      awaySubmittedAt: t.expose("awaySubmittedAt", { type: "DateTime", nullable: true }),
      awaySubmittedById: t.exposeID("awaySubmittedById", { nullable: true }),
      awayProofImageUrls: t.exposeStringList("awayProofImageUrls"),
      published: t.exposeBoolean("published"),
      fullyDecided: t.exposeBoolean("fullyDecided"),
      locked: t.exposeBoolean("locked"),
      isCurrentActive: t.exposeBoolean("isCurrentActive"),
    }),
  });

builder.prismaObject("Matchday", {
  fields: (t) => ({
    id: t.exposeID("id"),
    number: t.exposeInt("number"),
    label: t.exposeString("label", { nullable: true }),
    note: t.exposeString("note", { nullable: true }),
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
    // Round-64 — "entered by organizer" audit. Populated when a competition
    // organizer / SUPER_ADMIN entered lineups or frame results on behalf of
    // the teams (rather than a captain self-serving).
    staffInputBy: t.relation("staffInputBy", { nullable: true }),
    staffInputAt: t.expose("staffInputAt", {
      type: "DateTime",
      nullable: true,
    }),
    staffEnteredLineup: t.exposeBoolean("staffEnteredLineup"),
    staffEnteredResult: t.exposeBoolean("staffEnteredResult"),
    homeScore: t.exposeInt("homeScore", { nullable: true }),
    awayScore: t.exposeInt("awayScore", { nullable: true }),
    notes: t.exposeString("notes", { nullable: true }),
    // Round-67 — single-elimination bracket position.
    bracketRound: t.exposeInt("bracketRound", { nullable: true }),
    bracketPosition: t.exposeInt("bracketPosition", { nullable: true }),
    nextMatchId: t.exposeID("nextMatchId", { nullable: true }),
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
    // Round-60 — per-block lineup flow.
    lineupEditRequestedBlockOrder: t.exposeInt("lineupEditRequestedBlockOrder", {
      nullable: true,
    }),
    blockLineups: t.relation("blockLineups"),
    currentActiveBlockOrder: t.int({
      nullable: true,
      resolve: async (m, _a, ctx) => {
        const states = await computeBlockStates(ctx.prisma, m.id);
        return states.find((s) => s.isCurrentActive)?.blockOrder ?? null;
      },
    }),
    blockStates: t.field({
      type: [MatchBlockState],
      resolve: (m, _a, ctx) => computeBlockStates(ctx.prisma, m.id),
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
    blockOrder: t.exposeInt("blockOrder", { nullable: true }),
    homeWon: t.exposeBoolean("homeWon", { nullable: true }),
    isWalkover: t.exposeBoolean("isWalkover"),
    breakAndRun: t.exposeBoolean("breakAndRun"),
    homePlayer: t.exposeString("homePlayer", { nullable: true }),
    awayPlayer: t.exposeString("awayPlayer", { nullable: true }),
    homePlayerRef: t.relation("homePlayerRef", { nullable: true }),
    awayPlayerRef: t.relation("awayPlayerRef", { nullable: true }),
  }),
});

builder.prismaObject("MatchBlockLineup", {
  fields: (t) => ({
    id: t.exposeID("id"),
    side: t.exposeString("side"),
    blockOrder: t.exposeInt("blockOrder"),
    submittedBy: t.relation("submittedBy"),
    submittedAt: t.expose("submittedAt", { type: "DateTime" }),
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
    //
    // Round-63 — B&R is now *sticky*: a normal frame write can only ADD a
    // B&R (existing || incoming), never silently clear one the other captain
    // set. Deliberately removing a B&R requires clearBreakAndRun: true.
    breakAndRun: t.boolean(),
    clearBreakAndRun: t.boolean(),
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
    // Round-60 — the block (MatchFormatBlock.order) this lineup is for.
    blockOrder: t.int({ required: true }),
    slots: t.field({ type: [LineupSlotInput], required: true }),
    // Round-64 — which team this lineup is for ("HOME" | "AWAY"). Captains
    // omit it (their side is derived from their captaincy); an organizer /
    // admin entering a lineup on behalf of a team MUST pass it, since they
    // have no side of their own.
    side: t.string(),
    // Round-66 — optional proof photo(s) for this lineup submission.
    proofImageUrls: t.stringList(),
  }),
});
