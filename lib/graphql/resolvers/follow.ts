import { accessibleBy } from "@casl/prisma";
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
  followers: t.prismaField({
    type: ["User"],
    description:
      "Round-30 — users who follow a given competition or team. Cursor-paginated by Follow.id.",
    args: {
      entityType: t.arg({ type: FollowEntityTypeEnum, required: true }),
      entityId: t.arg.id({ required: true }),
      first: t.arg.int({ defaultValue: 30 }),
      after: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const take = Math.min(Math.max(args.first ?? 30, 1), 100);
      const rows = await ctx.prisma.follow.findMany({
        where: {
          entityType: args.entityType,
          entityId: String(args.entityId),
        },
        orderBy: { createdAt: "desc" },
        take,
        ...(args.after
          ? { skip: 1, cursor: { id: String(args.after) } }
          : {}),
        select: { id: true, userId: true },
      });
      if (rows.length === 0) return [];
      const users = await ctx.prisma.user.findMany({
        ...query,
        where: { id: { in: rows.map((r) => r.userId) } },
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      // Preserve follow order (newest first).
      return rows
        .map((r) => byId.get(r.userId))
        .filter((u): u is NonNullable<typeof u> => !!u);
    },
  }),

  // Round-50 — flip side of followers: who a user follows. The three
  // resolvers below mirror each other and power the tabbed Following page
  // on the public profile. Cursor-paginated by Follow.id; preserves
  // newest-follow-first ordering so the chip on the profile lines up.
  following: t.prismaField({
    type: ["User"],
    description: "Users this user follows. Cursor-paginated by Follow.id.",
    args: {
      userId: t.arg.id({ required: true }),
      first: t.arg.int({ defaultValue: 30 }),
      after: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const take = Math.min(Math.max(args.first ?? 30, 1), 100);
      const rows = await ctx.prisma.follow.findMany({
        where: {
          userId: String(args.userId),
          entityType: "USER",
        },
        orderBy: { createdAt: "desc" },
        take,
        ...(args.after ? { skip: 1, cursor: { id: String(args.after) } } : {}),
        select: { id: true, entityId: true },
      });
      if (rows.length === 0) return [];
      const users = await ctx.prisma.user.findMany({
        ...query,
        where: { id: { in: rows.map((r) => r.entityId) } },
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      return rows
        .map((r) => byId.get(r.entityId))
        .filter((u): u is NonNullable<typeof u> => !!u);
    },
  }),

  followedTeams: t.prismaField({
    type: ["Team"],
    description: "Teams this user follows. Cursor-paginated by Follow.id.",
    args: {
      userId: t.arg.id({ required: true }),
      first: t.arg.int({ defaultValue: 30 }),
      after: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const take = Math.min(Math.max(args.first ?? 30, 1), 100);
      const rows = await ctx.prisma.follow.findMany({
        where: {
          userId: String(args.userId),
          entityType: "TEAM",
        },
        orderBy: { createdAt: "desc" },
        take,
        ...(args.after ? { skip: 1, cursor: { id: String(args.after) } } : {}),
        select: { id: true, entityId: true },
      });
      if (rows.length === 0) return [];
      const teams = await ctx.prisma.team.findMany({
        ...query,
        where: { id: { in: rows.map((r) => r.entityId) } },
      });
      const byId = new Map(teams.map((t2) => [t2.id, t2]));
      return rows
        .map((r) => byId.get(r.entityId))
        .filter((t2): t2 is NonNullable<typeof t2> => !!t2);
    },
  }),

  followedCompetitions: t.prismaField({
    type: ["Competition"],
    description:
      "Competitions this user follows. CASL-filtered to readable comps " +
      "(DRAFT/CANCELLED are hidden for non-organizers).",
    args: {
      userId: t.arg.id({ required: true }),
      first: t.arg.int({ defaultValue: 30 }),
      after: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const take = Math.min(Math.max(args.first ?? 30, 1), 100);
      const rows = await ctx.prisma.follow.findMany({
        where: {
          userId: String(args.userId),
          entityType: "COMPETITION",
        },
        orderBy: { createdAt: "desc" },
        take,
        ...(args.after ? { skip: 1, cursor: { id: String(args.after) } } : {}),
        select: { id: true, entityId: true },
      });
      if (rows.length === 0) return [];
      const ids = rows.map((r) => r.entityId);
      const comps = await ctx.prisma.competition.findMany({
        ...query,
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Competition"),
            { id: { in: ids } },
          ],
        },
      });
      const byId = new Map(comps.map((c) => [c.id, c]));
      return rows
        .map((r) => byId.get(r.entityId))
        .filter((c): c is NonNullable<typeof c> => !!c);
    },
  }),

  followerCountFor: t.int({
    description: "Cheap count for the header chip.",
    args: {
      entityType: t.arg({ type: FollowEntityTypeEnum, required: true }),
      entityId: t.arg.id({ required: true }),
    },
    resolve: (_root, args, ctx) =>
      ctx.prisma.follow.count({
        where: {
          entityType: args.entityType,
          entityId: String(args.entityId),
        },
      }),
  }),

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
        where: {
          AND: [
            // Round-47 — CASL filter hides DRAFT/CANCELLED comps from
            // non-organizers even if they had previously followed them.
            accessibleBy(ctx.ability, "read").ofType("Competition"),
            { id: { in: ids } },
          ],
        },
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
      } else if (args.entityType === "TEAM") {
        await ctx.prisma.team.findUniqueOrThrow({ where: { id } });
      } else if (args.entityType === "USER") {
        if (id === ctx.viewer.id) {
          throw new GraphQLError("You can't follow yourself", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        await ctx.prisma.user.findUniqueOrThrow({ where: { id } });
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
  myTeamApplication: t.prismaField({
    type: "CompetitionApplication",
    nullable: true,
    description:
      "The viewer's most recent application to this comp (any status) — a team application they captain OR (Round-58 fix) a solo INDIVIDUAL application where they're the applicant. Used by the CTA + apply forms to gate Apply/Withdraw/Re-apply.",
    resolve: (query, c, _args, ctx) => {
      if (!ctx.viewer) return null;
      return ctx.prisma.competitionApplication.findFirst({
        ...query,
        where: {
          competitionId: c.id,
          OR: [
            { team: { captainId: ctx.viewer.id } },
            // Round-58 — solo INDIVIDUAL rows have teamId=null and the
            // viewer as applicant; without this branch the SoloApplyForm's
            // already-applied gate never fired and re-submits only failed
            // at the server with a confusing error.
            { applicantUserId: ctx.viewer.id },
          ],
        },
        orderBy: { submittedAt: "desc" },
      });
    },
  }),
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

// Round-33 — viewer's pending invitation to THIS team (if any). Powers the
// Accept/Decline banner on /teams/[slug].
builder.prismaObjectFields("Team", (t) => ({
  myInvitation: t.prismaField({
    type: "TeamInvitation",
    nullable: true,
    description:
      "The viewer's pending invitation to this team, if any. Null if no invite or already responded.",
    resolve: (query, team, _args, ctx) => {
      if (!ctx.viewer) return null;
      return ctx.prisma.teamInvitation.findFirst({
        ...query,
        where: {
          teamId: team.id,
          invitedUserId: ctx.viewer.id,
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      });
    },
  }),
}));

// Round-D — follow a player. The Follow model is already generic on
// (entityType, entityId), so we just expose the same accessors on User.
builder.prismaObjectFields("User", (t) => ({
  isFollowing: t.boolean({
    description: "True if the current viewer follows this user.",
    resolve: async (u, _args, ctx) => {
      if (!ctx.viewer) return false;
      if (ctx.viewer.id === u.id) return false;
      const f = await ctx.prisma.follow.findUnique({
        where: {
          userId_entityType_entityId: {
            userId: ctx.viewer.id,
            entityType: "USER",
            entityId: u.id,
          },
        },
        select: { id: true },
      });
      return !!f;
    },
  }),
  followerCount: t.int({
    resolve: (u, _args, ctx) =>
      ctx.prisma.follow.count({
        where: { entityType: "USER", entityId: u.id },
      }),
  }),
  followingCount: t.int({
    resolve: (u, _args, ctx) =>
      ctx.prisma.follow.count({ where: { userId: u.id } }),
  }),
  // Round-50 — per-category counts so the Following page can label its
  // tabs ("Players · 3 / Teams · 1 / Competitions · 2") and the viewer
  // knows where the action is when the default tab is empty.
  followingUsersCount: t.int({
    resolve: (u, _args, ctx) =>
      ctx.prisma.follow.count({
        where: { userId: u.id, entityType: "USER" },
      }),
  }),
  followingTeamsCount: t.int({
    resolve: (u, _args, ctx) =>
      ctx.prisma.follow.count({
        where: { userId: u.id, entityType: "TEAM" },
      }),
  }),
  followingCompetitionsCount: t.int({
    resolve: (u, _args, ctx) =>
      ctx.prisma.follow.count({
        where: { userId: u.id, entityType: "COMPETITION" },
      }),
  }),
}));

void GraphQLError;
