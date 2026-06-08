import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { requireUser } from "@/lib/casl/guard";
import { FollowEntityType } from "@/lib/generated/prisma/enums";

const FollowEntityTypeEnum = builder.enumType(FollowEntityType, {
  name: "FollowEntityType",
});

builder.prismaObject("Follow", {
  fields: (t) => ({
    id: t.exposeID("id"),
    entityType: t.expose("entityType", { type: FollowEntityTypeEnum }),
    entityId: t.exposeID("entityId"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

builder.queryFields((t) => ({
  myFollows: t.prismaField({
    type: ["Follow"],
    description:
      "Follow rows for the current viewer (competitions + teams they follow).",
    args: { entityType: t.arg({ type: FollowEntityTypeEnum }) },
    resolve: (query, _root, args, ctx) => {
      if (!ctx.viewer) return [];
      return ctx.prisma.follow.findMany({
        ...query,
        where: {
          userId: ctx.viewer.id,
          ...(args.entityType ? { entityType: args.entityType } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    },
  }),

  myFollowedCompetitions: t.prismaField({
    type: ["Competition"],
    description: "Competitions the viewer follows — newest follow first.",
    resolve: async (query, _root, _args, ctx) => {
      if (!ctx.viewer) return [];
      const follows = await ctx.prisma.follow.findMany({
        where: { userId: ctx.viewer.id, entityType: "COMPETITION" },
        orderBy: { createdAt: "desc" },
        select: { entityId: true },
      });
      if (follows.length === 0) return [];
      const ids = follows.map((f) => f.entityId);
      const rows = await ctx.prisma.competition.findMany({
        ...query,
        where: { id: { in: ids } },
      });
      // Preserve follow order.
      const byId = new Map(rows.map((r) => [r.id, r]));
      return ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
    },
  }),

  myFollowedTeams: t.prismaField({
    type: ["Team"],
    description: "Teams the viewer follows — newest follow first.",
    resolve: async (query, _root, _args, ctx) => {
      if (!ctx.viewer) return [];
      const follows = await ctx.prisma.follow.findMany({
        where: { userId: ctx.viewer.id, entityType: "TEAM" },
        orderBy: { createdAt: "desc" },
        select: { entityId: true },
      });
      if (follows.length === 0) return [];
      const ids = follows.map((f) => f.entityId);
      const rows = await ctx.prisma.team.findMany({
        ...query,
        where: { id: { in: ids } },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      return ids.map((id) => byId.get(id)).filter((t): t is NonNullable<typeof t> => !!t);
    },
  }),
}));

builder.mutationFields((t) => ({
  followEntity: t.prismaField({
    type: "Follow",
    args: {
      entityType: t.arg({ type: FollowEntityTypeEnum, required: true }),
      entityId: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      // Verify the target entity exists and is visible (light check).
      const id = String(args.entityId);
      if (args.entityType === "COMPETITION") {
        await ctx.prisma.competition.findUniqueOrThrow({ where: { id } });
      } else {
        await ctx.prisma.team.findUniqueOrThrow({ where: { id } });
      }
      return ctx.prisma.follow.upsert({
        ...query,
        where: {
          userId_entityType_entityId: {
            userId: ctx.viewer.id,
            entityType: args.entityType,
            entityId: id,
          },
        },
        update: {},
        create: {
          userId: ctx.viewer.id,
          entityType: args.entityType,
          entityId: id,
        },
      });
    },
  }),

  unfollowEntity: t.boolean({
    args: {
      entityType: t.arg({ type: FollowEntityTypeEnum, required: true }),
      entityId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      try {
        await ctx.prisma.follow.delete({
          where: {
            userId_entityType_entityId: {
              userId: ctx.viewer.id,
              entityType: args.entityType,
              entityId: String(args.entityId),
            },
          },
        });
      } catch {
        // Already unfollowed; treat as idempotent.
      }
      return true;
    },
  }),
}));

// Add isFollowing as a computed boolean on Competition + Team.
builder.prismaObjectFields("Competition", (t) => ({
  isFollowing: t.boolean({
    description: "True if the current viewer follows this competition.",
    resolve: async (c, _args, ctx) => {
      if (!ctx.viewer) return false;
      const f = await ctx.prisma.follow.findUnique({
        where: {
          userId_entityType_entityId: {
            userId: ctx.viewer.id,
            entityType: "COMPETITION",
            entityId: c.id,
          },
        },
        select: { id: true },
      });
      return !!f;
    },
  }),
  followerCount: t.int({
    resolve: (c, _args, ctx) =>
      ctx.prisma.follow.count({
        where: { entityType: "COMPETITION", entityId: c.id },
      }),
  }),
}));

builder.prismaObjectFields("Team", (t) => ({
  isFollowing: t.boolean({
    description: "True if the current viewer follows this team.",
    resolve: async (t2, _args, ctx) => {
      if (!ctx.viewer) return false;
      const f = await ctx.prisma.follow.findUnique({
        where: {
          userId_entityType_entityId: {
            userId: ctx.viewer.id,
            entityType: "TEAM",
            entityId: t2.id,
          },
        },
        select: { id: true },
      });
      return !!f;
    },
  }),
  followerCount: t.int({
    resolve: (t2, _args, ctx) =>
      ctx.prisma.follow.count({
        where: { entityType: "TEAM", entityId: t2.id },
      }),
  }),
}));

void GraphQLError;
