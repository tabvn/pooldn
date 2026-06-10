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
      "List all users, newest first. Cursor-paginated by id when first/after are supplied.",
    args: {
      first: t.arg.int(),
      after: t.arg.id(),
    },
    resolve: (query, _root, args, ctx) => {
      const take = Math.min(Math.max(args.first ?? 100, 1), 100);
      return ctx.prisma.user.findMany({
        ...query,
        where: { isActive: true },
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

  rankings: t.prismaField({
    type: ["User"],
    description:
      "Round-22 — global leaderboard of active players ordered by rating DESC. Cursor-paginated by User.id. Round-49 — optional teamId filter limits to players on that team (captain or member).",
    args: {
      first: t.arg.int(),
      after: t.arg.id(),
      teamId: t.arg.id(),
    },
    resolve: (query, _root, args, ctx) => {
      const take = Math.min(Math.max(args.first ?? 50, 1), 200);
      const teamId = args.teamId ? String(args.teamId) : null;
      return ctx.prisma.user.findMany({
        ...query,
        where: {
          isActive: true,
          role: { in: ["PLAYER", "TEAM_CAPTAIN"] },
          ...(teamId
            ? {
                OR: [
                  { captainedTeams: { some: { id: teamId } } },
                  { teamMemberships: { some: { teamId } } },
                ],
              }
            : {}),
        },
        orderBy: [{ rating: "desc" }, { id: "asc" }],
        take,
        ...(args.after ? { skip: 1, cursor: { id: String(args.after) } } : {}),
      });
    },
  }),
}));
