import { accessibleBy } from "@casl/prisma";
import { builder } from "../builder";
import { RosterConflict } from "../types/roster";

builder.queryFields((t) => ({
  rosterConflicts: t.field({
    type: [RosterConflict],
    description:
      "Players already rostered on another team in this competition. Used by Apply form to disable conflicting checkboxes.",
    args: {
      competitionId: t.arg.id({ required: true }),
      excludeTeamId: t.arg.id(),
    },
    resolve: async (_root, args, ctx) => {
      const competitionId = String(args.competitionId);
      // This exposes player names/usernames + team affiliations, so it must
      // honour competition visibility — don't leak a draft/private comp's
      // roster to anyone who guesses its id.
      const readable = await ctx.prisma.competition.findFirst({
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Competition"),
            { id: competitionId },
          ],
        },
        select: { id: true },
      });
      if (!readable) return [];
      const excludeTeamId = args.excludeTeamId ? String(args.excludeTeamId) : null;
      const [locked, applied] = await Promise.all([
        ctx.prisma.competitionRoster.findMany({
          where: {
            competitionId,
            ...(excludeTeamId ? { NOT: { teamId: excludeTeamId } } : {}),
          },
          include: {
            user: { select: { name: true, username: true } },
            team: { select: { name: true } },
          },
        }),
        ctx.prisma.applicationPlayer.findMany({
          where: {
            application: {
              competitionId,
              status: { in: ["PENDING", "WAITLISTED", "APPROVED"] },
              ...(excludeTeamId ? { NOT: { teamId: excludeTeamId } } : {}),
            },
          },
          include: {
            user: { select: { name: true, username: true } },
            application: { include: { team: { select: { name: true } } } },
          },
        }),
      ]);
      const out = [
        ...locked.map((r) => ({
          userId: r.userId,
          userName: r.user.name,
          userUsername: r.user.username,
          teamId: r.teamId,
          teamName: r.team.name,
          status: "ROSTERED",
        })),
        // Round-53 — solo INDIVIDUAL applications have no team and can't
        // block another team's roster, so drop those rows here.
        ...applied
          .filter((a) => a.application.teamId && a.application.team)
          .map((a) => ({
            userId: a.userId,
            userName: a.user.name,
            userUsername: a.user.username,
            teamId: a.application.teamId!,
            teamName: a.application.team!.name,
            status: a.application.status,
          })),
      ];
      // Dedup on userId — locked wins over applied.
      const seen = new Set<string>();
      return out.filter((r) =>
        seen.has(r.userId) ? false : (seen.add(r.userId), true),
      );
    },
  }),
}));
