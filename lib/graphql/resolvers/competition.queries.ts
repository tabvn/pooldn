import { accessibleBy } from "@casl/prisma";
import { builder } from "../builder";
import { CompetitionFilters } from "../types/competition";

builder.queryFields((t) => ({
  competitions: t.prismaField({
    type: ["Competition"],
    description:
      "List competitions visible to the viewer. Cursor-paginated by id when `first`/`after` are supplied; defaults to a generous slice for legacy callers.",
    args: {
      filters: t.arg({ type: CompetitionFilters }),
      first: t.arg.int(),
      after: t.arg.id(),
    },
    resolve: (query, _root, args, ctx) => {
      const f = args.filters;
      const take = Math.min(Math.max(args.first ?? 100, 1), 100);
      return ctx.prisma.competition.findMany({
        ...query,
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Competition"),
            ...(f?.status ? [{ status: f.status }] : []),
            ...(f?.cityId ? [{ cityId: String(f.cityId) }] : []),
            ...(f?.gameType ? [{ gameType: f.gameType }] : []),
            ...(f?.search
              ? [
                  {
                    OR: [
                      { name: { contains: f.search, mode: "insensitive" as const } },
                      { slug: { contains: f.search, mode: "insensitive" as const } },
                    ],
                  },
                ]
              : []),
          ],
        },
        orderBy: [{ startDate: "desc" }, { id: "asc" }],
        take,
        ...(args.after ? { skip: 1, cursor: { id: String(args.after) } } : {}),
      });
    },
  }),

  competition: t.prismaField({
    type: "Competition",
    nullable: true,
    description: "Look up a competition by slug.",
    args: { slug: t.arg.string({ required: true }) },
    resolve: (query, _root, args, ctx) =>
      ctx.prisma.competition.findFirst({
        ...query,
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Competition"),
            { slug: args.slug },
          ],
        },
      }),
  }),

  myCompetitions: t.prismaField({
    type: ["Competition"],
    description:
      "Competitions the viewer organizes — newest first. Returns [] when not signed in.",
    resolve: (query, _root, _args, ctx) => {
      if (!ctx.viewer) return [];
      return ctx.prisma.competition.findMany({
        ...query,
        where: { organizerId: ctx.viewer.id },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 50,
      });
    },
  }),

  competitionApplication: t.prismaField({
    type: "CompetitionApplication",
    nullable: true,
    description:
      "Round-50 — look up a single application by id. Used by the per-team " +
      "Application (players) page. Returns null if the parent competition " +
      "isn't readable to the viewer.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      const app = await ctx.prisma.competitionApplication.findFirst({
        ...query,
        where: { id: String(args.id) },
      });
      if (!app) return null;
      // Mirror the per-competition read gate so admins+organizers see drafts
      // while public viewers only see public competitions' applications.
      const readable = await ctx.prisma.competition.findFirst({
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Competition"),
            { id: app.competitionId },
          ],
        },
        select: { id: true },
      });
      return readable ? app : null;
    },
  }),
}));
