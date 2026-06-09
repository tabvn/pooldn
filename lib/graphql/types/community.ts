import { builder } from "../builder";

export const CommunityReactionTypeEnum = builder.enumType(
  "CommunityReactionType",
  {
    values: ["LIKE", "FIRE", "LAUGH", "CLAP", "TROPHY"] as const,
  },
);

export const ReactionCountObject = builder
  .objectRef<{ type: "LIKE" | "FIRE" | "LAUGH" | "CLAP" | "TROPHY"; count: number }>(
    "ReactionCount",
  )
  .implement({
    fields: (t) => ({
      type: t.field({
        type: CommunityReactionTypeEnum,
        resolve: (r) => r.type,
      }),
      count: t.exposeInt("count"),
    }),
  });

builder.prismaObject("CommunityPost", {
  fields: (t) => ({
    id: t.exposeID("id"),
    body: t.exposeString("body"),
    author: t.relation("author"),
    city: t.relation("city", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    tags: t.exposeStringList("tags"),
    imageUrls: t.exposeStringList("imageUrls"),
    isHidden: t.exposeBoolean("isHidden"),
    hiddenReason: t.exposeString("hiddenReason", { nullable: true }),
    pinnedAt: t.expose("pinnedAt", { type: "DateTime", nullable: true }),
    quotedPost: t.relation("quotedPost", { nullable: true }),
    quoteCount: t.int({
      resolve: (post, _args, ctx) =>
        ctx.prisma.communityPost.count({ where: { quotedPostId: post.id } }),
    }),
    comments: t.relation("comments", {
      query: (_args, ctx) => ({
        orderBy: { createdAt: "asc" },
        where: ctx.viewer?.role === "SUPER_ADMIN" ? {} : { isHidden: false },
      }),
    }),
    commentCount: t.int({
      resolve: (post, _args, ctx) =>
        ctx.prisma.communityComment.count({ where: { postId: post.id } }),
    }),
    reactionCounts: t.field({
      type: [ReactionCountObject],
      resolve: async (post, _args, ctx) => {
        const grouped = await ctx.prisma.communityReaction.groupBy({
          by: ["type"],
          where: { postId: post.id },
          _count: { type: true },
        });
        return grouped.map((g) => ({
          type: g.type,
          count: g._count.type,
        }));
      },
    }),
    viewerReactions: t.field({
      type: [CommunityReactionTypeEnum],
      resolve: async (post, _args, ctx) => {
        if (!ctx.viewer) return [];
        const rows = await ctx.prisma.communityReaction.findMany({
          where: { postId: post.id, userId: ctx.viewer.id },
          select: { type: true },
        });
        return rows.map((r) => r.type);
      },
    }),
    // Convenience aggregate the UI uses for the headline counter.
    reactionTotal: t.int({
      resolve: (post, _args, ctx) =>
        ctx.prisma.communityReaction.count({ where: { postId: post.id } }),
    }),
  }),
});

builder.prismaObject("CommunityComment", {
  fields: (t) => ({
    id: t.exposeID("id"),
    body: t.exposeString("body"),
    author: t.relation("author"),
    parentId: t.exposeID("parentId", { nullable: true }),
    editedAt: t.expose("editedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    isHidden: t.exposeBoolean("isHidden"),
    replies: t.relation("replies", {
      query: (_args, ctx) => ({
        orderBy: { createdAt: "asc" },
        where: ctx.viewer?.role === "SUPER_ADMIN" ? {} : { isHidden: false },
      }),
    }),
  }),
});

export const CreatePostInput = builder.inputType("CreatePostInput", {
  fields: (t) => ({
    body: t.string({ required: true }),
    cityId: t.id(),
    imageUrls: t.stringList(),
    quotedPostId: t.id(),
  }),
});
