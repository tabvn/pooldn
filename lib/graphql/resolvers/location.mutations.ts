import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { requireUser } from "@/lib/casl/guard";

function requireAdmin(ctx: { viewer: { role: string } | null }) {
  if (!ctx.viewer || ctx.viewer.role !== "SUPER_ADMIN") {
    throw new GraphQLError("Admins only", {
      extensions: { code: "FORBIDDEN" },
    });
  }
}

/**
 * Round-44 — Admin-managed locations.
 *
 * Cities + countries used to be implicitly seeded ("Da Nang, Vietnam") with
 * no UI to add more. Admins can now create / rename / soft-delete both via
 * /admin/locations.
 */
builder.mutationFields((t) => ({
  createCountry: t.prismaField({
    type: "Country",
    description: "Admin — create a new country.",
    args: {
      code: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      requireAdmin(ctx);
      const code = String(args.code).trim().toUpperCase();
      const name = String(args.name).trim();
      if (!/^[A-Z]{2,3}$/.test(code)) {
        throw new GraphQLError("Country code must be ISO 2 or 3 chars", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (name.length < 2) {
        throw new GraphQLError("Country name is too short", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const existing = await ctx.prisma.country.findUnique({ where: { code } });
      if (existing) {
        throw new GraphQLError("Country code already exists", {
          extensions: { code: "ALREADY_EXISTS" },
        });
      }
      return ctx.prisma.country.create({
        ...query,
        data: { code, name },
      });
    },
  }),

  createCity: t.prismaField({
    type: "City",
    description: "Admin — create a new city in an existing country.",
    args: {
      countryId: t.arg.id({ required: true }),
      name: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      requireAdmin(ctx);
      const name = String(args.name).trim();
      if (name.length < 2) {
        throw new GraphQLError("City name is too short", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const countryId = String(args.countryId);
      const country = await ctx.prisma.country.findUnique({
        where: { id: countryId },
        select: { id: true },
      });
      if (!country) {
        throw new GraphQLError("Country not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      const clash = await ctx.prisma.city.findUnique({
        where: { countryId_name: { countryId, name } },
      });
      if (clash) {
        throw new GraphQLError(
          "A city with that name already exists in this country",
          { extensions: { code: "ALREADY_EXISTS" } },
        );
      }
      return ctx.prisma.city.create({
        ...query,
        data: { countryId, name },
      });
    },
  }),

  renameCity: t.prismaField({
    type: "City",
    args: {
      id: t.arg.id({ required: true }),
      name: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      requireAdmin(ctx);
      return ctx.prisma.city.update({
        ...query,
        where: { id: String(args.id) },
        data: { name: String(args.name).trim() },
      });
    },
  }),

  setCityActive: t.prismaField({
    type: "City",
    description:
      "Admin — toggle a city active. Inactive cities are hidden from the default `cities` query and the header switcher; existing entities keep their cityId so deactivation is non-destructive.",
    args: {
      id: t.arg.id({ required: true }),
      isActive: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      requireAdmin(ctx);
      return ctx.prisma.city.update({
        ...query,
        where: { id: String(args.id) },
        data: { isActive: args.isActive },
      });
    },
  }),
}));
