import { accessibleBy } from "@casl/prisma";
import { builder } from "../builder";

builder.queryFields((t) => ({
  teams: t.prismaField({
    type: ["Team"],
    description:
      "List teams visible to the viewer. Cursor-paginated by id when first/after are supplied. Optional cityId scopes to teams homed in that city.",
    args: {
      first: t.arg.int(),
      after: t.arg.id(),
      cityId: t.arg.id(),
    },
    resolve: (query, _root, args, ctx) => {
      const take = Math.min(Math.max(args.first ?? 100, 1), 100);
      return ctx.prisma.team.findMany({
        ...query,
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Team"),
            ...(args.cityId ? [{ cityId: String(args.cityId) }] : []),
          ],
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take,
        ...(args.after ? { skip: 1, cursor: { id: String(args.after) } } : {}),
      });
    },
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

  myTeams: t.prismaField({
    type: ["Team"],
    description:
      "Round-29 — every team the viewer is on (captain or member). Used by the player profile Teams tab and dashboard 'Your teams' band.",
    resolve: (query, _root, _args, ctx) => {
      if (!ctx.viewer) return [];
      return ctx.prisma.team.findMany({
        ...query,
        where: {
          isActive: true,
          OR: [
            { captainId: ctx.viewer.id },
            { members: { some: { userId: ctx.viewer.id } } },
          ],
        },
        orderBy: [{ captainId: "desc" }, { name: "asc" }],
      });
    },
  }),
}));
