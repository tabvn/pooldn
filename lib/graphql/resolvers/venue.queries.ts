import { accessibleBy } from "@casl/prisma";
import { builder } from "../builder";

builder.queryFields((t) => ({
  venues: t.prismaField({
    type: ["Venue"],
    args: {
      cityId: t.arg.id(),
      first: t.arg.int(),
      after: t.arg.id(),
    },
    resolve: (query, _root, args, ctx) => {
      const take = Math.min(Math.max(args.first ?? 100, 1), 100);
      return ctx.prisma.venue.findMany({
        ...query,
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Venue"),
            args.cityId ? { cityId: String(args.cityId) } : {},
          ],
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take,
        ...(args.after ? { skip: 1, cursor: { id: String(args.after) } } : {}),
      });
    },
  }),

  venue: t.prismaField({
    type: "Venue",
    nullable: true,
    args: { slug: t.arg.string({ required: true }) },
    resolve: (query, _root, args, ctx) =>
      ctx.prisma.venue.findFirst({
        ...query,
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Venue"),
            { slug: args.slug },
          ],
        },
      }),
  }),

  cities: t.prismaField({
    type: ["City"],
    description:
      "Active cities only by default. Admins can pass includeInactive=true to see the soft-deactivated set.",
    args: { includeInactive: t.arg.boolean() },
    resolve: (query, _root, args, ctx) =>
      ctx.prisma.city.findMany({
        ...query,
        where: args.includeInactive ? {} : { isActive: true },
        orderBy: { name: "asc" },
      }),
  }),

  countries: t.prismaField({
    type: ["Country"],
    resolve: (query, _root, _args, ctx) =>
      ctx.prisma.country.findMany({ ...query, orderBy: { name: "asc" } }),
  }),
}));
