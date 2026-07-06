import { builder } from "../builder";

// Viewer-context fields on Competition / Team. These used to live in the
// (now-removed) follow resolver; they are unrelated to following and back
// core flows — the apply CTA and the team invite banner — so they were
// extracted here when the Follow feature was dropped.

builder.prismaObjectFields("Competition", (t) => ({
  myTeamApplication: t.prismaField({
    type: "CompetitionApplication",
    nullable: true,
    description:
      "The viewer's most recent application to this comp (any status) — a team application they captain OR a solo INDIVIDUAL application where they're the applicant. Used by the CTA + apply forms to gate Apply/Withdraw/Re-apply.",
    resolve: (query, c, _args, ctx) => {
      if (!ctx.viewer) return null;
      return ctx.prisma.competitionApplication.findFirst({
        ...query,
        where: {
          competitionId: c.id,
          OR: [
            { team: { captainId: ctx.viewer.id } },
            // Solo INDIVIDUAL rows have teamId=null and the viewer as
            // applicant; without this branch the SoloApplyForm's
            // already-applied gate never fires.
            { applicantUserId: ctx.viewer.id },
          ],
        },
        orderBy: { submittedAt: "desc" },
      });
    },
  }),
}));

builder.prismaObjectFields("Team", (t) => ({
  myInvitation: t.prismaField({
    type: "TeamInvitation",
    nullable: true,
    description:
      "The viewer's pending invitation to this team, if any. Null if no invite or already responded.",
    resolve: (query, team, _args, ctx) => {
      if (!ctx.viewer) return null;
      return ctx.prisma.teamInvitation.findFirst({
        ...query,
        where: {
          teamId: team.id,
          invitedUserId: ctx.viewer.id,
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      });
    },
  }),
}));
