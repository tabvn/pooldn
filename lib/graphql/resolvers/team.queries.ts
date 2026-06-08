import { accessibleBy } from "@casl/prisma";
import { builder } from "../builder";

builder.queryFields((t) => ({
  teams: t.prismaField({
    type: ["Team"],
    description: "List teams visible to the viewer.",
    resolve: (query, _root, _args, ctx) =>
      ctx.prisma.team.findMany({
        ...query,
        where: accessibleBy(ctx.ability, "read").ofType("Team"),
        orderBy: { name: "asc" },
      }),
  }),

  team: t.prismaField({
    type: "Team",
    nullable: true,
    description: "Look up a team by slug.",
    args: { slug: t.arg.string({ required: true }) },
    resolve: (query, _root, args, ctx) =>
      ctx.prisma.team.findFirst({
        ...query,
        where: {
          AND: [accessibleBy(ctx.ability, "read").ofType("Team"), { slug: args.slug }],
        },
      }),
  }),

  teamById: t.prismaField({
    type: "Team",
    nullable: true,
    description:
      "Look up a team by id (used by Match Flow to load a captain's roster).",
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args, ctx) =>
      ctx.prisma.team.findFirst({
        ...query,
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Team"),
            { id: String(args.id) },
          ],
        },
      }),
  }),
}));
