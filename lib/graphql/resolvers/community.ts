import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { CreatePostInput } from "../types/community";
import { requireUser } from "@/lib/casl/guard";

builder.queryFields((t) => ({
  communityPosts: t.prismaField({
    type: ["CommunityPost"],
    description: "Latest community posts, newest first.",
    args: {
      cityId: t.arg.id(),
      limit: t.arg.int({ defaultValue: 30 }),
    },
    resolve: (query, _root, args, ctx) =>
      ctx.prisma.communityPost.findMany({
        ...query,
        where: args.cityId ? { cityId: String(args.cityId) } : {},
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(args.limit ?? 30, 1), 100),
      }),
  }),
}));

builder.mutationFields((t) => ({
  createCommunityPost: t.prismaField({
    type: "CommunityPost",
    args: { input: t.arg({ type: CreatePostInput, required: true }) },
    resolve: (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      return ctx.prisma.communityPost.create({
        ...query,
        data: {
          authorId: ctx.viewer.id,
          body: args.input.body,
          cityId: args.input.cityId ? String(args.input.cityId) : null,
        },
      });
    },
  }),

  updateCommunityPost: t.prismaField({
    type: "CommunityPost",
    description: "Author (or SUPER_ADMIN) edits a community post body.",
    args: {
      id: t.arg.id({ required: true }),
      body: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const post = await ctx.prisma.communityPost.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      const isAuthor = post.authorId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isAuthor && !isAdmin) {
        throw new GraphQLError("Only the author or admin may edit", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      return ctx.prisma.communityPost.update({
        ...query,
        where: { id: post.id },
        data: { body: args.body },
      });
    },
  }),

  deleteCommunityPost: t.boolean({
    description: "Author (or SUPER_ADMIN) deletes a community post.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const post = await ctx.prisma.communityPost.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      const isAuthor = post.authorId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isAuthor && !isAdmin) {
        throw new GraphQLError("Only the author or admin may delete", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      await ctx.prisma.communityPost.delete({ where: { id: post.id } });
      return true;
    },
  }),
}));
