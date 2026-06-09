import { builder } from "../builder";
import { ScoreSubmissionStatus } from "@/lib/generated/prisma/enums";

export const ScoreSubmissionStatusEnum = builder.enumType(
  ScoreSubmissionStatus,
  { name: "ScoreSubmissionStatus" },
);

builder.prismaObject("MatchScoreSubmission", {
  fields: (t) => ({
    id: t.exposeID("id"),
    match: t.relation("match"),
    submittedBy: t.relation("submittedBy"),
    forTeam: t.relation("forTeam"),
    homeScore: t.exposeInt("homeScore"),
    awayScore: t.exposeInt("awayScore"),
    status: t.expose("status", { type: ScoreSubmissionStatusEnum }),
    reviewedBy: t.relation("reviewedBy", { nullable: true }),
    reviewedAt: t.expose("reviewedAt", { type: "DateTime", nullable: true }),
    note: t.exposeString("note", { nullable: true }),
    boardImageUrls: t.exposeStringList("boardImageUrls"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

export const SubmitMatchScoreInput = builder.inputType(
  "SubmitMatchScoreInput",
  {
    fields: (t) => ({
      matchId: t.id({ required: true }),
      homeScore: t.int({ required: true }),
      awayScore: t.int({ required: true }),
      note: t.string(),
      // Round-32 — photos of the physical scoresheet / scoreboard. Up to 3
      // images per submission; the resolver clamps the array.
      boardImageUrls: t.stringList(),
    }),
  },
);

export const ReviewMatchScoreInput = builder.inputType(
  "ReviewMatchScoreInput",
  {
    fields: (t) => ({
      matchId: t.id({ required: true }),
      homeScore: t.int({ required: true }),
      awayScore: t.int({ required: true }),
      note: t.string(),
    }),
  },
);
