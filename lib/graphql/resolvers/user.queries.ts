import { builder } from "../builder";
import { findUserById, listUsers } from "@/lib/services/user.service";

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
    description: "List all users, newest first.",
    resolve: (query, _root, _args, ctx) =>
      listUsers(ctx.prisma, query.select),
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
}));
