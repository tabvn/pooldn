import { accessibleBy } from "@casl/prisma";
import { builder } from "../builder";
import { CompetitionFilters } from "../types/competition";

builder.queryFields((t) => ({
  competitions: t.prismaField({
    type: ["Competition"],
    description: "List competitions visible to the viewer with optional filters.",
    args: {
      filters: t.arg({ type: CompetitionFilters }),
    },
    resolve: (query, _root, args, ctx) => {
      const f = args.filters;
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
        orderBy: { startDate: "desc" },
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
}));
