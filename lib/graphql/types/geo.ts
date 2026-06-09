import { builder } from "../builder";

builder.prismaObject("Country", {
  fields: (t) => ({
    id: t.exposeID("id"),
    code: t.exposeString("code"),
    name: t.exposeString("name"),
    cities: t.relation("cities", {
      args: { includeInactive: t.arg.boolean() },
      query: (args) => ({
        where: args.includeInactive ? {} : { isActive: true },
        orderBy: { name: "asc" },
      }),
    }),
  }),
});

builder.prismaObject("City", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    country: t.relation("country"),
    isActive: t.exposeBoolean("isActive"),
  }),
});

builder.prismaObject("Venue", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    slug: t.exposeString("slug"),
    address: t.exposeString("address"),
    city: t.relation("city"),
    phone: t.exposeString("phone", { nullable: true }),
    email: t.exposeString("email", { nullable: true }),
    website: t.exposeString("website", { nullable: true }),
    imageUrl: t.exposeString("imageUrl", { nullable: true }),
    tableCount: t.exposeInt("tableCount", { nullable: true }),
    isActive: t.exposeBoolean("isActive"),
    homeTeams: t.relation("homeTeams", {
      query: () => ({
        where: { isActive: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
    }),
    homeTeamCount: t.int({
      resolve: (v, _args, ctx) =>
        ctx.prisma.team.count({
          where: { homeVenueId: v.id, isActive: true },
        }),
    }),
  }),
});
