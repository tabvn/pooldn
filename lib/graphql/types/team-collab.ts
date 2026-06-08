import { builder } from "../builder";
import {
  TeamInviteStatus,
  JoinRequestStatus,
} from "@/lib/generated/prisma/enums";

export const TeamInviteStatusEnum = builder.enumType(TeamInviteStatus, {
  name: "TeamInviteStatus",
});

export const JoinRequestStatusEnum = builder.enumType(JoinRequestStatus, {
  name: "JoinRequestStatus",
});

builder.prismaObject("TeamInvitation", {
  fields: (t) => ({
    id: t.exposeID("id"),
    team: t.relation("team"),
    status: t.expose("status", { type: TeamInviteStatusEnum }),
    invitedUser: t.relation("invitedUser", { nullable: true }),
    invitedBy: t.relation("invitedBy"),
    email: t.exposeString("email", { nullable: true }),
    message: t.exposeString("message", { nullable: true }),
    token: t.exposeString("token"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    respondedAt: t.expose("respondedAt", {
      type: "DateTime",
      nullable: true,
    }),
  }),
});

builder.prismaObject("TeamJoinRequest", {
  fields: (t) => ({
    id: t.exposeID("id"),
    team: t.relation("team"),
    user: t.relation("user"),
    status: t.expose("status", { type: JoinRequestStatusEnum }),
    message: t.exposeString("message", { nullable: true }),
    reviewedBy: t.relation("reviewedBy", { nullable: true }),
    reviewedAt: t.expose("reviewedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});
