import { GraphQLError } from "graphql";
import { builder } from "../builder";
import {
  NotificationChannel,
  NotificationType,
} from "@/lib/generated/prisma/enums";
import { requireUser } from "@/lib/casl/guard";
import { setPreference } from "@/lib/services/notification-preferences";

const NotificationChannelEnum = builder.enumType(NotificationChannel, {
  name: "NotificationChannel",
});

// NotificationType is already registered for the Notification model fields,
// so re-using the enum here just by name.

builder.prismaObject("NotificationPreference", {
  fields: (t) => ({
    id: t.exposeID("id"),
    type: t.exposeString("type"),
    channel: t.expose("channel", { type: NotificationChannelEnum }),
    isEnabled: t.exposeBoolean("isEnabled"),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

builder.queryFields((t) => ({
  myNotificationPreferences: t.prismaField({
    type: ["NotificationPreference"],
    description:
      "Round-33 — every explicit pref row for the viewer; missing (type, channel) combos imply the default (in-app on, digest on, email off).",
    resolve: async (query, _root, _args, ctx) => {
      requireUser(ctx.viewer);
      return ctx.prisma.notificationPreference.findMany({
        ...query,
        where: { userId: ctx.viewer.id },
        orderBy: [{ type: "asc" }, { channel: "asc" }],
      });
    },
  }),
}));

builder.mutationFields((t) => ({
  setNotificationPreference: t.prismaField({
    type: "NotificationPreference",
    args: {
      type: t.arg.string({ required: true }),
      channel: t.arg({ type: NotificationChannelEnum, required: true }),
      isEnabled: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const validTypes = Object.values(NotificationType);
      if (!validTypes.includes(args.type as NotificationType)) {
        throw new GraphQLError(`Unknown notification type: ${args.type}`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      await setPreference(
        ctx.prisma,
        ctx.viewer.id,
        args.type as NotificationType,
        args.channel,
        args.isEnabled,
      );
      return ctx.prisma.notificationPreference.findFirstOrThrow({
        ...query,
        where: {
          userId: ctx.viewer.id,
          type: args.type as NotificationType,
          channel: args.channel,
        },
      });
    },
  }),
}));
