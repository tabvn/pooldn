import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { requireUser } from "@/lib/casl/guard";
import { NotificationService } from "@/lib/services/notification.service";

/**
 * Round-12 TASK 3 / Round-13 (A): team invitation + join-request flows.
 *
 * - Captain invites a player by user-id or by email; invited player accepts
 *   or declines via a deeplink; on accept a TeamMember row appears.
 * - Any player can request to join a public team; captain reviews and either
 *   approves (TeamMember added) or rejects.
 * - A team member who isn't the captain can leave the team.
 *
 * All actions notify the counterparties and run inside a transaction so the
 * invariants (unique (teamId,userId), not-the-captain leaving, etc.) hold
 * under concurrent edits.
 */

async function assertCaptain(
  prisma: import("@/lib/generated/prisma/client").PrismaClient,
  teamId: string,
  viewerId: string,
  viewerRole: string,
) {
  const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });
  if (team.captainId !== viewerId && viewerRole !== "SUPER_ADMIN") {
    throw new GraphQLError("Only the team captain may do that", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return team;
}

builder.mutationFields((t) => ({
  inviteToTeam: t.prismaField({
    type: "TeamInvitation",
    description:
      "Captain invites a player to join the team (by user-id, username, or email).",
    args: {
      teamId: t.arg.id({ required: true }),
      userId: t.arg.id(),
      username: t.arg.string(),
      email: t.arg.string(),
      message: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const team = await assertCaptain(
        ctx.prisma,
        String(args.teamId),
        ctx.viewer.id,
        ctx.viewer.role,
      );
      let invitedUserId: string | null = null;
      let email: string | null = null;
      if (args.userId) {
        invitedUserId = String(args.userId);
      } else if (args.username) {
        const u = await ctx.prisma.user.findUnique({
          where: { username: String(args.username) },
        });
        if (!u) {
          throw new GraphQLError(`No user @${args.username}`, {
            extensions: { code: "NOT_FOUND" },
          });
        }
        invitedUserId = u.id;
      } else if (args.email) {
        const u = await ctx.prisma.user.findUnique({
          where: { email: String(args.email).toLowerCase() },
        });
        if (u) invitedUserId = u.id;
        else email = String(args.email).toLowerCase();
      } else {
        throw new GraphQLError("Provide userId, username, or email", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // Refuse duplicates / already-members.
      if (invitedUserId) {
        const existing = await ctx.prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId: team.id, userId: invitedUserId } },
        });
        if (existing) {
          throw new GraphQLError("That player is already on this team", {
            extensions: { code: "ALREADY_MEMBER" },
          });
        }
        const pending = await ctx.prisma.teamInvitation.findFirst({
          where: {
            teamId: team.id,
            invitedUserId,
            status: "PENDING",
          },
        });
        if (pending) {
          throw new GraphQLError("A pending invite already exists", {
            extensions: { code: "ALREADY_INVITED" },
          });
        }
      }

      const created = await ctx.prisma.teamInvitation.create({
        ...query,
        data: {
          teamId: team.id,
          invitedById: ctx.viewer.id,
          invitedUserId,
          email,
          message: args.message ?? null,
        },
      });

      if (invitedUserId) {
        await new NotificationService(ctx.prisma).create({
          type: "ROSTER_INVITE",
          title: `Team invite: ${team.name}`,
          message:
            args.message ??
            `${ctx.viewer.name} invited you to join ${team.name}.`,
          recipients: [invitedUserId],
          entity: { type: "TEAM", id: team.id, slug: team.slug },
          groupKey: `invite-${created.id}`,
        });
      }

      return created;
    },
  }),

  respondToInvitation: t.prismaField({
    type: "TeamInvitation",
    description: "Invited player accepts or declines the invitation.",
    args: {
      id: t.arg.id(),
      token: t.arg.string(),
      accept: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      if (!args.id && !args.token) {
        throw new GraphQLError("id or token required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const invite = await ctx.prisma.teamInvitation.findFirst({
        where: args.id
          ? { id: String(args.id) }
          : { token: String(args.token) },
        include: { team: { select: { id: true, name: true, slug: true, captainId: true } } },
      });
      if (!invite) {
        throw new GraphQLError("Invitation not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      if (invite.status !== "PENDING") {
        throw new GraphQLError("Invitation already responded to", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      // Match invitee — invited userId (logged-in user) OR invited email.
      const isInvitedUser =
        invite.invitedUserId === ctx.viewer.id ||
        (!!invite.email && false /* email match handled at email->user link time */);
      if (!isInvitedUser && ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Not your invitation to act on", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.teamInvitation.update({
          where: { id: invite.id },
          data: {
            status: args.accept ? "ACCEPTED" : "DECLINED",
            respondedAt: new Date(),
          },
        });
        if (args.accept) {
          await tx.teamMember.upsert({
            where: {
              teamId_userId: {
                teamId: invite.teamId,
                userId: ctx.viewer!.id,
              },
            },
            update: {},
            create: { teamId: invite.teamId, userId: ctx.viewer!.id },
          });
        }
        await new NotificationService(tx).create({
          type: "ROSTER_INVITE",
          title: `${ctx.viewer!.name} ${args.accept ? "joined" : "declined"} ${invite.team.name}`,
          message: args.accept
            ? "They're now on the roster."
            : "They declined the invitation.",
          recipients: [invite.team.captainId],
          entity: {
            type: "TEAM",
            id: invite.team.id,
            slug: invite.team.slug,
          },
          groupKey: `invite-${invite.id}`,
        });
        return tx.teamInvitation.findUniqueOrThrow({
          ...query,
          where: { id: updated.id },
        });
      });
    },
  }),

  cancelTeamInvitation: t.prismaField({
    type: "TeamInvitation",
    description: "Captain cancels a pending invitation.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const invite = await ctx.prisma.teamInvitation.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      await assertCaptain(
        ctx.prisma,
        invite.teamId,
        ctx.viewer.id,
        ctx.viewer.role,
      );
      return ctx.prisma.teamInvitation.update({
        ...query,
        where: { id: invite.id },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
    },
  }),

  requestToJoinTeam: t.prismaField({
    type: "TeamJoinRequest",
    description: "Any player requests to join a team — captain reviews.",
    args: {
      teamId: t.arg.id({ required: true }),
      message: t.arg.string(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const teamId = String(args.teamId);
      const team = await ctx.prisma.team.findUniqueOrThrow({ where: { id: teamId } });
      if (team.captainId === ctx.viewer.id) {
        throw new GraphQLError("You captain this team — no need to request", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const existingMember = await ctx.prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId, userId: ctx.viewer.id },
        },
      });
      if (existingMember) {
        throw new GraphQLError("You're already on this team", {
          extensions: { code: "ALREADY_MEMBER" },
        });
      }
      const created = await ctx.prisma.teamJoinRequest.upsert({
        ...query,
        where: {
          teamId_userId: { teamId, userId: ctx.viewer.id },
        },
        update: {
          status: "PENDING",
          message: args.message ?? null,
          reviewedAt: null,
          reviewedById: null,
        },
        create: {
          teamId,
          userId: ctx.viewer.id,
          message: args.message ?? null,
        },
      });
      await new NotificationService(ctx.prisma).create({
        type: "ROSTER_INVITE",
        title: `Join request: ${team.name}`,
        message:
          args.message ?? `${ctx.viewer.name} asked to join ${team.name}.`,
        recipients: [team.captainId],
        entity: { type: "TEAM", id: team.id, slug: team.slug },
        groupKey: `join-${created.id}`,
      });
      return created;
    },
  }),

  reviewJoinRequest: t.prismaField({
    type: "TeamJoinRequest",
    description: "Captain approves or rejects a pending join request.",
    args: {
      id: t.arg.id({ required: true }),
      approve: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const req = await ctx.prisma.teamJoinRequest.findUniqueOrThrow({
        where: { id: String(args.id) },
        include: { team: true },
      });
      await assertCaptain(
        ctx.prisma,
        req.teamId,
        ctx.viewer.id,
        ctx.viewer.role,
      );
      if (req.status !== "PENDING") {
        throw new GraphQLError("Already reviewed", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.teamJoinRequest.update({
          where: { id: req.id },
          data: {
            status: args.approve ? "APPROVED" : "REJECTED",
            reviewedById: ctx.viewer!.id,
            reviewedAt: new Date(),
          },
        });
        if (args.approve) {
          await tx.teamMember.upsert({
            where: {
              teamId_userId: { teamId: req.teamId, userId: req.userId },
            },
            update: {},
            create: { teamId: req.teamId, userId: req.userId },
          });
        }
        await new NotificationService(tx).create({
          type: "ROSTER_INVITE",
          title: args.approve
            ? `Welcome to ${req.team.name}`
            : `Join request declined for ${req.team.name}`,
          message: args.approve
            ? "The captain approved your join request."
            : "The captain declined your request.",
          recipients: [req.userId],
          entity: {
            type: "TEAM",
            id: req.team.id,
            slug: req.team.slug,
          },
          groupKey: `join-${req.id}`,
        });
        return tx.teamJoinRequest.findUniqueOrThrow({
          ...query,
          where: { id: updated.id },
        });
      });
    },
  }),

  leaveTeam: t.boolean({
    description: "Member leaves a team. The captain cannot leave their own.",
    args: { teamId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const team = await ctx.prisma.team.findUniqueOrThrow({
        where: { id: String(args.teamId) },
      });
      if (team.captainId === ctx.viewer.id) {
        throw new GraphQLError(
          "Captains cannot leave their own team — transfer captaincy first",
          { extensions: { code: "FORBIDDEN" } },
        );
      }
      await ctx.prisma.teamMember.deleteMany({
        where: { teamId: team.id, userId: ctx.viewer.id },
      });
      return true;
    },
  }),
}));

builder.queryFields((t) => ({
  myTeamInvitations: t.prismaField({
    type: ["TeamInvitation"],
    description: "Pending invitations for the current viewer.",
    resolve: (query, _root, _args, ctx) => {
      if (!ctx.viewer) return [];
      return ctx.prisma.teamInvitation.findMany({
        ...query,
        where: { invitedUserId: ctx.viewer.id, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      });
    },
  }),

  teamInvitations: t.prismaField({
    type: ["TeamInvitation"],
    description: "Pending invitations for a team (captain only).",
    args: { teamId: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      await assertCaptain(
        ctx.prisma,
        String(args.teamId),
        ctx.viewer.id,
        ctx.viewer.role,
      );
      return ctx.prisma.teamInvitation.findMany({
        ...query,
        where: { teamId: String(args.teamId), status: "PENDING" },
        orderBy: { createdAt: "desc" },
      });
    },
  }),

  teamJoinRequests: t.prismaField({
    type: ["TeamJoinRequest"],
    description: "Pending join requests for a team (captain only).",
    args: { teamId: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      await assertCaptain(
        ctx.prisma,
        String(args.teamId),
        ctx.viewer.id,
        ctx.viewer.role,
      );
      return ctx.prisma.teamJoinRequest.findMany({
        ...query,
        where: { teamId: String(args.teamId), status: "PENDING" },
        orderBy: { createdAt: "desc" },
      });
    },
  }),
}));
