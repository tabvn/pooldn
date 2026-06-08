import { accessibleBy } from "@casl/prisma";
import { builder } from "../builder";

builder.queryFields((t) => ({
  venues: t.prismaField({
    type: ["Venue"],
    args: { cityId: t.arg.id() },
    resolve: (query, _root, args, ctx) =>
      ctx.prisma.venue.findMany({
        ...query,
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Venue"),
            args.cityId ? { cityId: String(args.cityId) } : {},
          ],
        },
        orderBy: { name: "asc" },
      }),
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
    resolve: (query, _root, _args, ctx) =>
      ctx.prisma.city.findMany({ ...query, orderBy: { name: "asc" } }),
  }),
}));
