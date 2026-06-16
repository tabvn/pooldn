import { builder } from "../builder";
import { findUserById } from "@/lib/services/user.service";

builder.queryFields((t) => ({
  user: t.prismaField({
    type: "User",
    nullable: true,
    description: "Look up a user by id.",
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: (query, _root, args, ctx) =>
      findUserById(ctx.prisma, String(args.id), query.select),
  }),

  users: t.prismaField({
    type: ["User"],
    description:
      "List users, newest first. Cursor-paginated by id when first/after are supplied. Optional cityId scopes to players in that city (the app's top-level location filter).",
    args: {
      first: t.arg.int(),
      after: t.arg.id(),
      cityId: t.arg.id(),
    },
    resolve: (query, _root, args, ctx) => {
      const take = Math.min(Math.max(args.first ?? 100, 1), 100);
      return ctx.prisma.user.findMany({
        ...query,
        where: {
          isActive: true,
          ...(args.cityId ? { cityId: String(args.cityId) } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take,
        ...(args.after ? { skip: 1, cursor: { id: String(args.after) } } : {}),
      });
    },
  }),

  userByUsername: t.prismaField({
    type: "User",
    nullable: true,
    description: "Look up a user by their public username.",
    args: { username: t.arg.string({ required: true }) },
    resolve: (query, _root, args, ctx) =>
      ctx.prisma.user.findUnique({
        ...query,
        where: { username: args.username.toLowerCase() },
      }),
  }),
  // Round-54 — `rankings` deleted along with the rating system.
}));
