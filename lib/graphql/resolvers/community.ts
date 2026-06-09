import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { CommunityReactionTypeEnum, CreatePostInput } from "../types/community";
import { requireUser } from "@/lib/casl/guard";
import { NotificationService } from "@/lib/services/notification.service";
import { extractMentions, extractTags } from "@/lib/services/community-parse";

/**
 * Resolve a list of @usernames to user-ids, dropping unknowns and the author
 * themselves (you don't notify yourself for mentioning yourself).
 */
/**
 * Round-44 — restricted mention scope.
 *
 * A user can only @mention someone they're already connected to:
 *   - **Teammates** — anyone who shares an active TeamMember row with them.
 *   - **Post author** — when commenting on a post, the post's author is in
 *     scope.
 *   - **Other commenters on the same post** — comment threads are a
 *     conversation; everyone in it can mention each other.
 *
 * Out-of-scope mentions are dropped silently (no error, no notification) —
 * @-typo-ing a stranger shouldn't error the post.
 *
 * `postId` is optional — for top-level post creation the scope is just
 * teammates. For comments we widen to the post's author + prior commenters.
 */
async function resolveMentions(
  prisma: import("@/lib/generated/prisma/client").PrismaClient,
  usernames: string[],
  authorId: string,
  postId?: string,
): Promise<string[]> {
  if (usernames.length === 0) return [];

  // Build the in-scope set:
  //   1. teammates (shared active team membership)
  //   2. post author (if commenting)
  //   3. prior commenters on this post (if commenting)
  const teamMemberships = await prisma.teamMember.findMany({
    where: { userId: authorId, isActive: true },
    select: { teamId: true },
  });
  const teammateIds: string[] = teamMemberships.length
    ? (
        await prisma.teamMember.findMany({
          where: {
            teamId: { in: teamMemberships.map((m) => m.teamId) },
            isActive: true,
            userId: { not: authorId },
          },
          select: { userId: true },
        })
      ).map((m) => m.userId)
    : [];
  const scope = new Set<string>(teammateIds);

  if (postId) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (post) scope.add(post.authorId);
    const commenters = await prisma.communityComment.findMany({
      where: { postId },
      select: { authorId: true },
      distinct: ["authorId"],
    });
    for (const c of commenters) scope.add(c.authorId);
  }
  // Always remove the author themselves so they don't @-ping themselves.
  scope.delete(authorId);

  // Now resolve the usernames into ids and intersect with the scope.
  const rows = await prisma.user.findMany({
    where: { username: { in: usernames } },
    select: { id: true },
  });
  return rows.map((r) => r.id).filter((id) => scope.has(id));
}

builder.queryFields((t) => ({
  communityPosts: t.prismaField({
    type: ["CommunityPost"],
    description:
      "Community feed, newest first. Hidden posts are invisible to non-admins; posts from blocked authors are filtered out for the viewer; pinned posts bubble to the top.",
    args: {
      cityId: t.arg.id(),
      tag: t.arg.string(),
      authorId: t.arg.id(),
      first: t.arg.int({ defaultValue: 30 }),
      after: t.arg.id(),
    },
    resolve: async (query, _root, args, ctx) => {
      const take = Math.min(Math.max(args.first ?? 30, 1), 100);
      const isAdmin = ctx.viewer?.role === "SUPER_ADMIN";
      // Build the block list once so we don't hit the table on every row.
      let blockedIds: string[] = [];
      if (ctx.viewer) {
        const blocks = await ctx.prisma.communityBlock.findMany({
          where: { blockerId: ctx.viewer.id },
          select: { blockedId: true },
        });
        blockedIds = blocks.map((b) => b.blockedId);
      }
      return ctx.prisma.communityPost.findMany({
        ...query,
        where: {
          ...(args.cityId ? { cityId: String(args.cityId) } : {}),
          ...(args.authorId ? { authorId: String(args.authorId) } : {}),
          ...(args.tag
            ? { tags: { has: String(args.tag).toLowerCase() } }
            : {}),
          ...(isAdmin ? {} : { isHidden: false }),
          ...(blockedIds.length > 0
            ? { authorId: { notIn: blockedIds } }
            : {}),
        },
        // Pinned posts (when present) bubble to the top, then newest-first.
        // NULLS LAST on pinnedAt would be ideal but Prisma supports it via
        // the explicit `{ sort, nulls }` shape only on some providers; the
        // stable ordering here is good enough for our scale.
        orderBy: [
          { pinnedAt: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
          { id: "asc" },
        ],
        take,
        ...(args.after ? { skip: 1, cursor: { id: String(args.after) } } : {}),
      });
    },
  }),

  communityPost: t.prismaField({
    type: "CommunityPost",
    nullable: true,
    description:
      "Look up a community post by id. Hidden posts are visible to admins and to the original author (so they know it was moderated); everyone else gets null.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      const isAdmin = ctx.viewer?.role === "SUPER_ADMIN";
      const post = await ctx.prisma.communityPost.findUnique({
        ...query,
        where: { id: String(args.id) },
      });
      if (!post) return null;
      if (post.isHidden && !isAdmin && post.authorId !== ctx.viewer?.id) {
        return null;
      }
      return post;
    },
  }),

  trendingCommunityPosts: t.prismaField({
    type: ["CommunityPost"],
    description:
      "Round-A5 — posts ranked by recent engagement (reactions + comments) over the last 7 days.",
    args: {
      limit: t.arg.int({ defaultValue: 20 }),
    },
    resolve: async (query, _root, args, ctx) => {
      const sinceMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const since = new Date(sinceMs);
      // Score = reactions + comments within the window for each post.
      // Done as two groupBy queries because Prisma can't aggregate across two
      // relations in one shot; the post count is small enough (recent 7d) for
      // this to be fast.
      const reactRows = await ctx.prisma.communityReaction.groupBy({
        by: ["postId"],
        where: { createdAt: { gte: since } },
        _count: { postId: true },
      });
      const commentRows = await ctx.prisma.communityComment.groupBy({
        by: ["postId"],
        where: { createdAt: { gte: since } },
        _count: { postId: true },
      });
      const score = new Map<string, number>();
      for (const r of reactRows) {
        score.set(r.postId, (score.get(r.postId) ?? 0) + r._count.postId);
      }
      for (const c of commentRows) {
        score.set(c.postId, (score.get(c.postId) ?? 0) + c._count.postId * 2);
      }
      const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]);
      const take = Math.min(Math.max(args.limit ?? 20, 1), 50);
      const ids = ranked.slice(0, take).map(([id]) => id);
      if (ids.length === 0) {
        // Fallback to newest if nothing engaged in the window.
        return ctx.prisma.communityPost.findMany({
          ...query,
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take,
        });
      }
      const posts = await ctx.prisma.communityPost.findMany({
        ...query,
        where: { id: { in: ids } },
      });
      // Re-order by score (Prisma `in` doesn't preserve order).
      const order = new Map(ids.map((id, i) => [id, i]));
      return posts.sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      );
    },
  }),
}));

builder.mutationFields((t) => ({
  createCommunityPost: t.prismaField({
    type: "CommunityPost",
    args: { input: t.arg({ type: CreatePostInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const body = args.input.body.trim();
      if (!body) {
        throw new GraphQLError("Post can't be empty", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (body.length > 4000) {
        throw new GraphQLError("Post is too long (4000 chars max)", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const tags = extractTags(body);
      const mentions = extractMentions(body);
      const images = (args.input.imageUrls ?? [])
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 4);
      const viewerId = ctx.viewer.id;
      const viewerName = ctx.viewer.name;

      // Round-A6 — validate quoted post (must exist; can't quote yourself
      // recursively beyond one level — we just reject chains of quotes).
      let quotedAuthorId: string | null = null;
      const quotedPostId = args.input.quotedPostId
        ? String(args.input.quotedPostId)
        : null;
      if (quotedPostId) {
        const q = await ctx.prisma.communityPost.findUnique({
          where: { id: quotedPostId },
          select: { authorId: true, quotedPostId: true },
        });
        if (!q) {
          throw new GraphQLError("Quoted post not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }
        if (q.quotedPostId) {
          throw new GraphQLError("Can't quote a quote — quote the original.", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        quotedAuthorId = q.authorId;
      }

      const post = await ctx.prisma.communityPost.create({
        ...query,
        data: {
          authorId: viewerId,
          body,
          cityId: args.input.cityId ? String(args.input.cityId) : null,
          tags,
          imageUrls: images,
          quotedPostId,
        },
      });

      const svc = new NotificationService(ctx.prisma);

      // Round-A2 — notify @-mentioned users (excluding the author themselves).
      const mentionRecipients = await resolveMentions(
        ctx.prisma,
        mentions,
        viewerId,
      );
      if (mentionRecipients.length > 0) {
        await svc.create({
          type: "COMMUNITY_MENTION",
          title: `${viewerName} mentioned you`,
          message: body.slice(0, 80),
          recipients: mentionRecipients,
          entity: { type: "COMMUNITY_POST", id: post.id },
        });
      }

      // Round-A6 — notify the quoted post's author (unless it's a self-quote
      // or the quoted author was already pinged via @mention).
      if (
        quotedAuthorId &&
        quotedAuthorId !== viewerId &&
        !mentionRecipients.includes(quotedAuthorId)
      ) {
        await svc.create({
          type: "COMMUNITY_QUOTE",
          title: `${viewerName} quoted your post`,
          message: body.slice(0, 80),
          recipients: [quotedAuthorId],
          entity: { type: "COMMUNITY_POST", id: post.id },
        });
      }

      return post;
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
      const body = String(args.body).trim();
      const tags = extractTags(body);
      return ctx.prisma.communityPost.update({
        ...query,
        where: { id: post.id },
        data: { body, tags },
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

  toggleCommunityReaction: t.prismaField({
    type: "CommunityPost",
    description:
      "Round-A1 — toggle a reaction (LIKE/FIRE/LAUGH/CLAP/TROPHY) on a post.",
    args: {
      postId: t.arg.id({ required: true }),
      type: t.arg({ type: CommunityReactionTypeEnum, required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const postId = String(args.postId);
      const viewerId = ctx.viewer.id;
      const existing = await ctx.prisma.communityReaction.findUnique({
        where: {
          postId_userId_type: { postId, userId: viewerId, type: args.type },
        },
      });
      if (existing) {
        await ctx.prisma.communityReaction.delete({ where: { id: existing.id } });
      } else {
        await ctx.prisma.communityReaction.create({
          data: { postId, userId: viewerId, type: args.type },
        });
        // Only notify the post author for LIKE (the primary reaction) so the
        // inbox doesn't blow up when someone hits the emoji picker hard.
        if (args.type === "LIKE") {
          const post = await ctx.prisma.communityPost.findUniqueOrThrow({
            where: { id: postId },
            select: { authorId: true, body: true },
          });
          if (post.authorId !== viewerId) {
            await new NotificationService(ctx.prisma).create({
              type: "COMMUNITY_LIKE",
              title: "Someone liked your post",
              message: post.body.slice(0, 80),
              recipients: [post.authorId],
              entity: { type: "COMMUNITY_POST", id: postId },
            });
          }
        }
      }
      return ctx.prisma.communityPost.findUniqueOrThrow({
        ...query,
        where: { id: postId },
      });
    },
  }),

  createCommunityComment: t.prismaField({
    type: "CommunityComment",
    description:
      "Round-27 — comment on a post (or reply to a parent comment). Notifies the post author + parent comment author + any @mentioned users.",
    args: {
      postId: t.arg.id({ required: true }),
      parentId: t.arg.id(),
      body: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const body = String(args.body).trim();
      if (body.length === 0) {
        throw new GraphQLError("Comment can't be empty", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const postId = String(args.postId);
      const post = await ctx.prisma.communityPost.findUniqueOrThrow({
        where: { id: postId },
        select: { authorId: true, body: true },
      });
      let parentAuthorId: string | null = null;
      if (args.parentId) {
        const parent = await ctx.prisma.communityComment.findUniqueOrThrow({
          where: { id: String(args.parentId) },
          select: { postId: true, authorId: true },
        });
        if (parent.postId !== postId) {
          throw new GraphQLError("Parent comment is on a different post", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        parentAuthorId = parent.authorId;
      }
      const comment = await ctx.prisma.communityComment.create({
        ...query,
        data: {
          postId,
          authorId: ctx.viewer.id,
          parentId: args.parentId ? String(args.parentId) : null,
          body,
        },
      });
      const recipients = new Set<string>();
      if (post.authorId !== ctx.viewer.id) recipients.add(post.authorId);
      if (parentAuthorId && parentAuthorId !== ctx.viewer.id) {
        recipients.add(parentAuthorId);
      }
      const svc = new NotificationService(ctx.prisma);
      if (recipients.size > 0) {
        await svc.create({
          type: args.parentId ? "COMMUNITY_REPLY" : "COMMUNITY_COMMENT",
          title: args.parentId ? "New reply on your comment" : "New comment on your post",
          message: body.slice(0, 80),
          recipients: Array.from(recipients),
          entity: { type: "COMMUNITY_POST", id: postId },
          metadata: { commentId: comment.id },
        });
      }
      // Round-A2 — also notify @mentioned users (excluding overlap with the
      // post-author / parent-author / commenter).
      const mentions = extractMentions(body);
      const mentionIds = await resolveMentions(
        ctx.prisma,
        mentions,
        ctx.viewer.id,
        postId,
      );
      const mentionOnly = mentionIds.filter((id) => !recipients.has(id));
      if (mentionOnly.length > 0) {
        await svc.create({
          type: "COMMUNITY_MENTION",
          title: `${ctx.viewer.name} mentioned you`,
          message: body.slice(0, 80),
          recipients: mentionOnly,
          entity: { type: "COMMUNITY_POST", id: postId },
          metadata: { commentId: comment.id },
        });
      }
      return comment;
    },
  }),

  updateCommunityComment: t.prismaField({
    type: "CommunityComment",
    args: {
      id: t.arg.id({ required: true }),
      body: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const c = await ctx.prisma.communityComment.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      const isAuthor = c.authorId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isAuthor && !isAdmin) {
        throw new GraphQLError("Only the author or admin may edit", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      return ctx.prisma.communityComment.update({
        ...query,
        where: { id: c.id },
        data: { body: String(args.body), editedAt: new Date() },
      });
    },
  }),

  deleteCommunityComment: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const c = await ctx.prisma.communityComment.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      const isAuthor = c.authorId === ctx.viewer.id;
      const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
      if (!isAuthor && !isAdmin) {
        throw new GraphQLError("Only the author or admin may delete", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      await ctx.prisma.communityComment.delete({ where: { id: c.id } });
      return true;
    },
  }),
}));
