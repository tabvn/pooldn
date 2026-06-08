import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { ensure, requireUser } from "@/lib/casl/guard";

const CreateVenueInput = builder.inputType("CreateVenueInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    slug: t.string({ required: true }),
    address: t.string({ required: true }),
    cityId: t.id({ required: true }),
    phone: t.string(),
    email: t.string(),
    website: t.string(),
    tableCount: t.int(),
    imageUrl: t.string(),
  }),
});

const UpdateVenueInput = builder.inputType("UpdateVenueInput", {
  fields: (t) => ({
    name: t.string(),
    address: t.string(),
    cityId: t.id(),
    phone: t.string(),
    email: t.string(),
    website: t.string(),
    tableCount: t.int(),
    imageUrl: t.string(),
    isActive: t.boolean(),
  }),
});

builder.mutationFields((t) => ({
  createVenue: t.prismaField({
    type: "Venue",
    description: "Create a venue. ORGANIZER or SUPER_ADMIN only.",
    args: { input: t.arg({ type: CreateVenueInput, required: true }) },
    resolve: (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      if (
        ctx.viewer.role !== "ORGANIZER" &&
        ctx.viewer.role !== "SUPER_ADMIN"
      ) {
        throw new GraphQLError("Only organizers can create venues", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      return ctx.prisma.venue.create({
        ...query,
        data: {
          name: args.input.name,
          slug: args.input.slug,
          address: args.input.address,
          cityId: String(args.input.cityId),
          phone: args.input.phone ?? null,
          email: args.input.email ?? null,
          website: args.input.website ?? null,
          tableCount: args.input.tableCount ?? null,
          imageUrl: args.input.imageUrl ?? null,
        },
      });
    },
  }),

  updateVenue: t.prismaField({
    type: "Venue",
    description: "Edit a venue's details. Organizer/admin only.",
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateVenueInput, required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const venue = await ctx.prisma.venue.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      ensure(ctx.ability, "update", {
        ...venue,
        __caslSubjectType__: "Venue",
      });
      return ctx.prisma.venue.update({
        ...query,
        where: { id: venue.id },
        data: {
          name: args.input.name ?? undefined,
          address: args.input.address ?? undefined,
          cityId: args.input.cityId
            ? String(args.input.cityId)
            : undefined,
          phone: args.input.phone === null ? null : args.input.phone ?? undefined,
          email: args.input.email === null ? null : args.input.email ?? undefined,
          website: args.input.website === null ? null : args.input.website ?? undefined,
          tableCount:
            args.input.tableCount === null
              ? null
              : args.input.tableCount ?? undefined,
          imageUrl:
            args.input.imageUrl === null
              ? null
              : args.input.imageUrl ?? undefined,
          isActive: args.input.isActive ?? undefined,
        },
      });
    },
  }),

  deleteVenue: t.boolean({
    description:
      "Soft-delete a venue (sets isActive=false). Organizer/admin only.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const venue = await ctx.prisma.venue.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      ensure(ctx.ability, "delete", {
        ...venue,
        __caslSubjectType__: "Venue",
      });
      await ctx.prisma.venue.update({
        where: { id: venue.id },
        data: { isActive: false },
      });
      return true;
    },
  }),
}));
