import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { requireUser } from "@/lib/casl/guard";

const CommunityReportTargetEnum = builder.enumType("CommunityReportTarget", {
  values: ["POST", "COMMENT"] as const,
});
const CommunityReportStatusEnum = builder.enumType("CommunityReportStatus", {
  values: ["OPEN", "RESOLVED", "DISMISSED"] as const,
});

builder.prismaObject("CommunityReport", {
  fields: (t) => ({
    id: t.exposeID("id"),
    reporter: t.relation("reporter"),
    targetType: t.expose("targetType", { type: CommunityReportTargetEnum }),
    targetId: t.exposeID("targetId"),
    reason: t.exposeString("reason"),
    status: t.expose("status", { type: CommunityReportStatusEnum }),
    reviewedBy: t.relation("reviewedBy", { nullable: true }),
    reviewedAt: t.expose("reviewedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    // The post id the target lives on. For POST reports it equals targetId;
    // for COMMENT reports we resolve the parent post so the admin queue can
    // deep-link to /community/<postId>?c=<commentId>.
    targetPostId: t.string({
      nullable: true,
      resolve: async (r, _args, ctx) => {
        if (r.targetType === "POST") return r.targetId;
        const c = await ctx.prisma.communityComment.findUnique({
          where: { id: r.targetId },
          select: { postId: true },
        });
        return c?.postId ?? null;
      },
    }),
  }),
});

builder.prismaObject("CommunityBlock", {
  fields: (t) => ({
    id: t.exposeID("id"),
    blocker: t.relation("blocker"),
    blocked: t.relation("blocked"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

function requireAdmin(ctx: { viewer: { role: string } | null }) {
  if (!ctx.viewer || ctx.viewer.role !== "SUPER_ADMIN") {
    throw new GraphQLError("Admins only", {
      extensions: { code: "FORBIDDEN" },
    });
  }
}

builder.queryFields((t) => ({
  communityReports: t.prismaField({
    type: ["CommunityReport"],
    description:
      "Admin queue of community reports. Filter by status; defaults to OPEN.",
    args: {
      status: t.arg({ type: CommunityReportStatusEnum }),
      first: t.arg.int({ defaultValue: 50 }),
      after: t.arg.id(),
    },
    resolve: (query, _root, args, ctx) => {
      requireAdmin(ctx);
      const take = Math.min(Math.max(args.first ?? 50, 1), 100);
      return ctx.prisma.communityReport.findMany({
        ...query,
        where: args.status ? { status: args.status } : { status: "OPEN" },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take,
        ...(args.after ? { skip: 1, cursor: { id: String(args.after) } } : {}),
      });
    },
  }),

  myBlockedUsers: t.prismaField({
    type: ["User"],
    description: "Users the viewer has blocked.",
    resolve: async (query, _root, _args, ctx) => {
      if (!ctx.viewer) return [];
      const rows = await ctx.prisma.communityBlock.findMany({
        where: { blockerId: ctx.viewer.id },
        select: { blockedId: true },
      });
      const ids = rows.map((r) => r.blockedId);
      if (ids.length === 0) return [];
      return ctx.prisma.user.findMany({
        ...query,
        where: { id: { in: ids } },
      });
    },
  }),
}));

builder.mutationFields((t) => ({
  reportCommunity: t.prismaField({
    type: "CommunityReport",
    description: "File a report against a post or comment.",
    args: {
      targetType: t.arg({ type: CommunityReportTargetEnum, required: true }),
      targetId: t.arg.id({ required: true }),
      reason: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const reason = String(args.reason).trim();
      if (reason.length === 0) {
        throw new GraphQLError("Reason can't be empty", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (reason.length > 500) {
        throw new GraphQLError("Reason too long (500 chars max)", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      // Verify the target exists so reporters can't lob ghost rows at the queue.
      if (args.targetType === "POST") {
        await ctx.prisma.communityPost.findUniqueOrThrow({
          where: { id: String(args.targetId) },
          select: { id: true },
        });
      } else {
        await ctx.prisma.communityComment.findUniqueOrThrow({
          where: { id: String(args.targetId) },
          select: { id: true },
        });
      }
      return ctx.prisma.communityReport.create({
        ...query,
        data: {
          reporterId: ctx.viewer.id,
          targetType: args.targetType,
          targetId: String(args.targetId),
          reason,
        },
      });
    },
  }),

  resolveCommunityReport: t.prismaField({
    type: "CommunityReport",
    args: {
      id: t.arg.id({ required: true }),
      status: t.arg({ type: CommunityReportStatusEnum, required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireAdmin(ctx);
      if (args.status === "OPEN") {
        throw new GraphQLError("Use a terminal status (RESOLVED / DISMISSED)", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return ctx.prisma.communityReport.update({
        ...query,
        where: { id: String(args.id) },
        data: {
          status: args.status,
          reviewedById: ctx.viewer!.id,
          reviewedAt: new Date(),
        },
      });
    },
  }),

  hideCommunityPost: t.prismaField({
    type: "CommunityPost",
    description:
      "Admin soft-hides a post (visible to nobody except admins) with an optional reason. Pass hide=false to unhide.",
    args: {
      id: t.arg.id({ required: true }),
      hide: t.arg.boolean({ required: true }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireAdmin(ctx);
      return ctx.prisma.communityPost.update({
        ...query,
        where: { id: String(args.id) },
        data: args.hide
          ? {
              isHidden: true,
              hiddenReason: args.reason ?? null,
              hiddenById: ctx.viewer!.id,
              hiddenAt: new Date(),
            }
          : {
              isHidden: false,
              hiddenReason: null,
              hiddenById: null,
              hiddenAt: null,
            },
      });
    },
  }),

  hideCommunityComment: t.prismaField({
    type: "CommunityComment",
    args: {
      id: t.arg.id({ required: true }),
      hide: t.arg.boolean({ required: true }),
      reason: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireAdmin(ctx);
      return ctx.prisma.communityComment.update({
        ...query,
        where: { id: String(args.id) },
        data: args.hide
          ? {
              isHidden: true,
              hiddenReason: args.reason ?? null,
              hiddenById: ctx.viewer!.id,
              hiddenAt: new Date(),
            }
          : {
              isHidden: false,
              hiddenReason: null,
              hiddenById: null,
              hiddenAt: null,
            },
      });
    },
  }),

  pinCommunityPost: t.prismaField({
    type: "CommunityPost",
    description:
      "Admin pins a post to the top of its city feed (or global feed if no city). Pass pin=false to unpin.",
    args: {
      id: t.arg.id({ required: true }),
      pin: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireAdmin(ctx);
      return ctx.prisma.communityPost.update({
        ...query,
        where: { id: String(args.id) },
        data: { pinnedAt: args.pin ? new Date() : null },
      });
    },
  }),

  blockUser: t.boolean({
    description:
      "Viewer hides all posts/comments from this user. Toggle: pass block=false to unblock.",
    args: {
      userId: t.arg.id({ required: true }),
      block: t.arg.boolean({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const blockedId = String(args.userId);
      if (blockedId === ctx.viewer.id) {
        throw new GraphQLError("You can't block yourself", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (args.block) {
        await ctx.prisma.communityBlock.upsert({
          where: {
            blockerId_blockedId: {
              blockerId: ctx.viewer.id,
              blockedId,
            },
          },
          create: { blockerId: ctx.viewer.id, blockedId },
          update: {},
        });
      } else {
        await ctx.prisma.communityBlock.deleteMany({
          where: { blockerId: ctx.viewer.id, blockedId },
        });
      }
      return true;
    },
  }),
}));
