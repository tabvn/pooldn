import type { Notification } from "@/lib/generated/prisma/client";
import { builder } from "../builder";
import { requireUser } from "@/lib/casl/guard";

// Connection envelope for cursor-paginated notifications. Rows are fetched
// once in the parent resolver; `nodes` returns them directly so the bell
// count and inbox list cannot disagree (no second query, no id-then-refetch).
const NotificationConnection = builder
  .objectRef<{
    nodes: Notification[];
    nextCursor: string | null;
  }>("NotificationConnection")
  .implement({
    fields: (t) => ({
      // We already fetched the full Notification rows in the parent resolver,
      // so we just hand them back. `t.prismaField` accepts the string subject
      // name; Pothos resolves the model fields from the returned models.
      nodes: t.prismaField({
        type: ["Notification"],
        resolve: (_query, parent) => parent.nodes,
      }),
      nextCursor: t.exposeID("nextCursor", { nullable: true }),
    }),
  });

builder.queryFields((t) => ({
  notifications: t.field({
    type: NotificationConnection,
    description:
      "Cursor-paginated notifications for the current viewer, newest first.",
    args: {
      first: t.arg.int({ defaultValue: 20 }),
      after: t.arg.id(),
      onlyUnread: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const first = Math.min(Math.max(args.first ?? 20, 1), 50);
      const where = {
        userId: ctx.viewer.id,
        ...(args.onlyUnread ? { isRead: false } : {}),
      };
      const rows = await ctx.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: first + 1,
        ...(args.after
          ? { cursor: { id: String(args.after) }, skip: 1 }
          : {}),
      });
      const hasMore = rows.length > first;
      const page = hasMore ? rows.slice(0, first) : rows;
      return {
        nodes: page,
        nextCursor: hasMore ? page[page.length - 1].id : null,
      };
    },
  }),

  unreadNotificationCount: t.int({
    description: "Number of unread notifications for the current viewer.",
    resolve: (_root, _args, ctx) => {
      if (!ctx.viewer) return 0;
      return ctx.prisma.notification.count({
        where: { userId: ctx.viewer.id, isRead: false },
      });
    },
  }),
}));

builder.mutationFields((t) => ({
  markNotificationRead: t.prismaField({
    type: "Notification",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const note = await ctx.prisma.notification.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      if (note.userId !== ctx.viewer.id) {
        throw new Error("Forbidden");
      }
      return ctx.prisma.notification.update({
        ...query,
        where: { id: note.id },
        data: { isRead: true },
      });
    },
  }),

  markAllNotificationsRead: t.int({
    description:
      "Mark every notification for the viewer as read; returns the number of rows updated.",
    resolve: async (_root, _args, ctx) => {
      requireUser(ctx.viewer);
      const result = await ctx.prisma.notification.updateMany({
        where: { userId: ctx.viewer.id, isRead: false },
        data: { isRead: true },
      });
      return result.count;
    },
  }),
}));
