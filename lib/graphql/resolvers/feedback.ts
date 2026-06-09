import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { NotificationService } from "@/lib/services/notification.service";
import {
  FeedbackStatus,
  FeedbackType,
} from "@/lib/generated/prisma/enums";

const FeedbackTypeEnum = builder.enumType(FeedbackType, {
  name: "FeedbackType",
});
const FeedbackStatusEnum = builder.enumType(FeedbackStatus, {
  name: "FeedbackStatus",
});

builder.prismaObject("Feedback", {
  fields: (t) => ({
    id: t.exposeID("id"),
    user: t.relation("user", { nullable: true }),
    contactEmail: t.exposeString("contactEmail", { nullable: true }),
    type: t.expose("type", { type: FeedbackTypeEnum }),
    subject: t.exposeString("subject"),
    message: t.exposeString("message"),
    status: t.expose("status", { type: FeedbackStatusEnum }),
    adminNote: t.exposeString("adminNote", { nullable: true }),
    resolvedBy: t.relation("resolvedBy", { nullable: true }),
    resolvedAt: t.expose("resolvedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

function requireAdmin(ctx: import("../context").GraphQLContext) {
  if (!ctx.viewer) {
    throw new GraphQLError("Sign in required", {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
  if (ctx.viewer.role !== "SUPER_ADMIN") {
    throw new GraphQLError("Admin only", {
      extensions: { code: "FORBIDDEN" },
    });
  }
}

builder.queryFields((t) => ({
  feedbackInbox: t.prismaField({
    type: ["Feedback"],
    description:
      "Admin inbox — every feedback row, optionally filtered by status / type.",
    args: {
      status: t.arg({ type: FeedbackStatusEnum }),
      type: t.arg({ type: FeedbackTypeEnum }),
      first: t.arg.int({ defaultValue: 20 }),
      after: t.arg.string(),
    },
    resolve: (query, _root, args, ctx) => {
      requireAdmin(ctx);
      const take = Math.min(Math.max(args.first ?? 20, 1), 100);
      return ctx.prisma.feedback.findMany({
        ...query,
        where: {
          ...(args.status ? { status: args.status } : {}),
          ...(args.type ? { type: args.type } : {}),
        },
        orderBy: { createdAt: "desc" },
        take,
        ...(args.after ? { skip: 1, cursor: { id: String(args.after) } } : {}),
      });
    },
  }),

  feedbackById: t.prismaField({
    type: "Feedback",
    nullable: true,
    description: "Single feedback row (admin only).",
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args, ctx) => {
      requireAdmin(ctx);
      return ctx.prisma.feedback.findUnique({
        ...query,
        where: { id: String(args.id) },
      });
    },
  }),

  feedbackUnreadCount: t.int({
    description: "Count of NEW feedback rows (admin badge).",
    resolve: (_root, _args, ctx) => {
      if (!ctx.viewer || ctx.viewer.role !== "SUPER_ADMIN") return 0;
      return ctx.prisma.feedback.count({ where: { status: "NEW" } });
    },
  }),
}));

builder.mutationFields((t) => ({
  /** Round-29 — replaces the older boolean `submitFeedback` mutation. */
  createFeedback: t.prismaField({
    type: "Feedback",
    description:
      "Persist a feedback submission and notify every SUPER_ADMIN.",
    args: {
      type: t.arg({ type: FeedbackTypeEnum }),
      subject: t.arg.string({ required: true }),
      message: t.arg.string({ required: true }),
      contactEmail: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      const subject = String(args.subject).trim().slice(0, 200);
      const message = String(args.message).trim().slice(0, 4000);
      if (!subject || !message) {
        throw new GraphQLError("Subject and message are required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const row = await ctx.prisma.feedback.create({
        ...query,
        data: {
          userId: ctx.viewer?.id ?? null,
          contactEmail: args.contactEmail?.trim() || null,
          type: args.type ?? "OTHER",
          subject,
          message,
        },
      });
      const admins = await ctx.prisma.user.findMany({
        where: { role: "SUPER_ADMIN" },
        select: { id: true },
      });
      if (admins.length > 0) {
        const author = ctx.viewer ? ctx.viewer.name : "Guest";
        const contact =
          args.contactEmail ?? (ctx.viewer ? "(signed in)" : "(anonymous)");
        await new NotificationService(ctx.prisma).create({
          type: "WELCOME",
          title: `Feedback: ${subject}`,
          message: `${author} — ${contact}`,
          recipients: admins.map((a) => a.id),
          entity: { type: "USER", id: row.id, slug: row.id },
          groupKey: `feedback-${row.id}`,
        });
      }
      return row;
    },
  }),

  updateFeedbackStatus: t.prismaField({
    type: "Feedback",
    description:
      "Admin updates a feedback row's status and (optionally) leaves a note.",
    args: {
      id: t.arg.id({ required: true }),
      status: t.arg({ type: FeedbackStatusEnum, required: true }),
      adminNote: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireAdmin(ctx);
      const isResolved = args.status === "RESOLVED" || args.status === "CLOSED";
      return ctx.prisma.feedback.update({
        ...query,
        where: { id: String(args.id) },
        data: {
          status: args.status,
          adminNote: args.adminNote ?? undefined,
          resolvedById: isResolved ? ctx.viewer!.id : null,
          resolvedAt: isResolved ? new Date() : null,
        },
      });
    },
  }),

  deleteFeedback: t.boolean({
    description:
      "Admin removes a feedback row entirely (e.g. spam, duplicates, resolved long ago).",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireAdmin(ctx);
      await ctx.prisma.feedback.delete({ where: { id: String(args.id) } });
      return true;
    },
  }),
}));
