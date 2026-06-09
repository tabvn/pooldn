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
 * Round-46 — admin moderation mutations + lookup queries.
 *
 * Banning is a HARD lockout: a banned user cannot read or write anything
 * via the API (enforced in `lib/graphql/context.ts`) and the Next.js
 * middleware sends them to /banned for every page request. Unban reverses.
 * Deleting a team is destructive — cascade rules in the schema clean up
 * members + applications + matches.
 */
builder.mutationFields((t) => ({
  banUser: t.prismaField({
    type: "User",
    description:
      "Admin — ban a user. They lose access to every page + GraphQL op until unbanned.",
    args: {
      id: t.arg.id({ required: true }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      requireAdmin(ctx);
      const id = String(args.id);
      if (id === ctx.viewer.id) {
        throw new GraphQLError("You can't ban yourself", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const target = await ctx.prisma.user.findUniqueOrThrow({ where: { id } });
      if (target.role === "SUPER_ADMIN") {
        throw new GraphQLError("Can't ban another admin", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      const updated = await ctx.prisma.user.update({
        ...query,
        where: { id },
        data: {
          bannedAt: new Date(),
          banReason: args.reason ?? null,
        },
      });
      // Round-47 — best-effort email notice. Fire-and-forget; a mail
      // delivery failure must not roll back the ban.
      void (async () => {
        try {
          const { sendBanNotice } = await import("@/lib/services/email.service");
          await sendBanNotice({
            to: target.email,
            name: target.name,
            reason: args.reason ?? null,
          });
        } catch (e) {
          console.warn("[banUser] email send failed:", e);
        }
      })();
      return updated;
    },
  }),

  unbanUser: t.prismaField({
    type: "User",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      requireAdmin(ctx);
      return ctx.prisma.user.update({
        ...query,
        where: { id: String(args.id) },
        data: { bannedAt: null, banReason: null },
      });
    },
  }),

  banTeam: t.prismaField({
    type: "Team",
    description:
      "Admin — ban a team. The team is locked out of roster changes and new applications.",
    args: {
      id: t.arg.id({ required: true }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      requireAdmin(ctx);
      return ctx.prisma.team.update({
        ...query,
        where: { id: String(args.id) },
        data: {
          bannedAt: new Date(),
          banReason: args.reason ?? null,
        },
      });
    },
  }),

  unbanTeam: t.prismaField({
    type: "Team",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      requireAdmin(ctx);
      return ctx.prisma.team.update({
        ...query,
        where: { id: String(args.id) },
        data: { bannedAt: null, banReason: null },
      });
    },
  }),

  deleteTeamHard: t.boolean({
    description:
      "Admin — hard-delete a team. Members, applications and matches cascade.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      requireAdmin(ctx);
      await ctx.prisma.team.delete({ where: { id: String(args.id) } });
      return true;
    },
  }),
}));

builder.queryFields((t) => ({
  bannedUsers: t.prismaField({
    type: ["User"],
    description: "Cursor-paginated list of users currently banned (admin).",
    args: {
      first: t.arg.int({ defaultValue: 25 }),
      after: t.arg.id(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      requireAdmin(ctx);
      const take = Math.min(Math.max(args.first ?? 25, 1), 100);
      return ctx.prisma.user.findMany({
        ...query,
        where: { bannedAt: { not: null } },
        orderBy: [{ bannedAt: "desc" }, { id: "asc" }],
        take,
        ...(args.after
          ? { skip: 1, cursor: { id: String(args.after) } }
          : {}),
      });
    },
  }),

  bannedTeams: t.prismaField({
    type: ["Team"],
    description: "Cursor-paginated list of teams currently banned (admin).",
    args: {
      first: t.arg.int({ defaultValue: 25 }),
      after: t.arg.id(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      requireAdmin(ctx);
      const take = Math.min(Math.max(args.first ?? 25, 1), 100);
      return ctx.prisma.team.findMany({
        ...query,
        where: { bannedAt: { not: null } },
        orderBy: [{ bannedAt: "desc" }, { id: "asc" }],
        take,
        ...(args.after
          ? { skip: 1, cursor: { id: String(args.after) } }
          : {}),
      });
    },
  }),
}));
