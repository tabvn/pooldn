import { builder } from "../builder";
import {
  NotificationEntityType,
  NotificationType,
} from "@/lib/generated/prisma/enums";
import { notificationDeeplink } from "@/lib/services/notification.service";

export const NotificationTypeEnum = builder.enumType(NotificationType, {
  name: "NotificationType",
});

export const NotificationEntityTypeEnum = builder.enumType(
  NotificationEntityType,
  { name: "NotificationEntityType" },
);

builder.prismaObject("Notification", {
  fields: (t) => ({
    id: t.exposeID("id"),
    type: t.expose("type", { type: NotificationTypeEnum }),
    title: t.exposeString("title"),
    message: t.exposeString("message"),
    isRead: t.exposeBoolean("isRead"),
    entityType: t.expose("entityType", {
      type: NotificationEntityTypeEnum,
      nullable: true,
    }),
    entityId: t.exposeID("entityId", { nullable: true }),
    entitySlug: t.exposeString("entitySlug", { nullable: true }),
    groupKey: t.exposeString("groupKey", { nullable: true }),
    href: t.string({
      nullable: true,
      description: "Deeplink derived from entityType + entitySlug/entityId.",
      resolve: (n) => notificationDeeplink(n),
    }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});
