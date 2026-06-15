import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { CreateTeamInput } from "../types/team";
import { ensure, requireUser } from "@/lib/casl/guard";
import { NotificationService } from "@/lib/services/notification.service";

const UpdateTeamInput = builder.inputType("UpdateTeamInput", {
  fields: (t) => ({
    name: t.string(),
    description: t.string(),
    logoUrl: t.string(),
    isActive: t.boolean(),
    // Round-48 — captain manages the team's home venue from the manage page.
    // Passing null clears the home venue; omitting leaves it untouched.
    homeVenueId: t.id(),
  }),
});

builder.mutationFields((t) => ({
  createTeam: t.prismaField({
    type: "Team",
    description:
      "Create a team. Viewer becomes the captain. Optional `invites` accept usernames/emails and fan out as ROSTER_INVITE.",
    args: { input: t.arg({ type: CreateTeamInput, required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      // Round-30 — any signed-in user can create a team. Captaincy is per-team
      // (team.captainId), not a global role; the creator is captain of THIS
      // team only. VIEWER is the one role we still gate (read-only persona).
      if (ctx.viewer.role === "VIEWER") {
        throw new GraphQLError(
          "Sign up for a player account to create a team",
          { extensions: { code: "FORBIDDEN" } },
        );
      }
      const viewer = ctx.viewer;

      // Friendly slug uniqueness check before we hit the @@unique constraint.
      const slugTaken = await ctx.prisma.team.findUnique({
        where: { slug: args.input.slug },
        select: { id: true },
      });
      if (slugTaken) {
        throw new GraphQLError("That team slug is already taken", {
          extensions: { code: "SLUG_TAKEN" },
        });
      }

      // Round-35 — resolve each invite token into either a userId or an
      // email; reject self-invites and dedup so we don't create double rows.
      type Resolved = { invitedUserId: string | null; email: string | null };
      const resolved: Resolved[] = [];
      const seenUserIds = new Set<string>();
      const seenEmails = new Set<string>();
      for (const raw of args.input.invites ?? []) {
        const token = String(raw).trim();
        if (!token) continue;
        if (token.includes("@")) {
          const email = token.toLowerCase();
          if (seenEmails.has(email)) continue;
          seenEmails.add(email);
          const u = await ctx.prisma.user.findUnique({
            where: { email },
            select: { id: true },
          });
          if (u) {
            if (u.id === viewer.id) {
              throw new GraphQLError("You can't invite yourself", {
                extensions: { code: "BAD_USER_INPUT" },
              });
            }
            if (seenUserIds.has(u.id)) continue;
            seenUserIds.add(u.id);
            resolved.push({ invitedUserId: u.id, email: null });
          } else {
            resolved.push({ invitedUserId: null, email });
          }
        } else {
          const username = token.replace(/^@/, "").toLowerCase();
          const u = await ctx.prisma.user.findUnique({
            where: { username },
            select: { id: true },
          });
          if (!u) {
            throw new GraphQLError(`No user @${username}`, {
              extensions: { code: "NOT_FOUND" },
            });
          }
          if (u.id === viewer.id) {
            throw new GraphQLError("You can't invite yourself", {
              extensions: { code: "BAD_USER_INPUT" },
            });
          }
          if (seenUserIds.has(u.id)) continue;
          seenUserIds.add(u.id);
          resolved.push({ invitedUserId: u.id, email: null });
        }
      }

      const { team, invitationIds } = await ctx.prisma.$transaction(async (tx) => {
        const t = await tx.team.create({
          data: {
            name: args.input.name,
            slug: args.input.slug,
            logoUrl: args.input.logoUrl ?? null,
            description: args.input.description ?? null,
            cityId: args.input.cityId ? String(args.input.cityId) : null,
            homeVenueId: args.input.homeVenueId
              ? String(args.input.homeVenueId)
              : null,
            captainId: viewer.id,
            members: { create: { userId: viewer.id } },
          },
        });
        const ids: Array<{ id: string; invitedUserId: string | null }> = [];
        for (const r of resolved) {
          const inv = await tx.teamInvitation.create({
            data: {
              teamId: t.id,
              invitedById: viewer.id,
              invitedUserId: r.invitedUserId,
              email: r.email,
            },
            select: { id: true, invitedUserId: true },
          });
          ids.push(inv);
        }
        return { team: t, invitationIds: ids };
      });

      // Notifications go after the tx so a notification failure doesn't roll
      // back team creation. Fire-and-forget per recipient.
      const svc = new NotificationService(ctx.prisma);
      for (const inv of invitationIds) {
        if (!inv.invitedUserId) continue;
        await svc.create({
          type: "ROSTER_INVITE",
          title: `Team invite: ${team.name}`,
          message: `${viewer.name} invited you to join ${team.name}.`,
          recipients: [inv.invitedUserId],
          entity: { type: "TEAM", id: team.id, slug: team.slug },
          groupKey: `invite-${inv.id}`,
        });
      }

      return ctx.prisma.team.findUniqueOrThrow({
        ...query,
        where: { id: team.id },
      });
    },
  }),

  updateTeam: t.prismaField({
    type: "Team",
    description: "Edit a team (name/description/logo). Captain or admin only.",
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateTeamInput, required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const team = await ctx.prisma.team.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      ensure(ctx.ability, "update", {
        ...team,
        __caslSubjectType__: "Team",
      });
      return ctx.prisma.team.update({
        ...query,
        where: { id: team.id },
        data: {
          name: args.input.name ?? undefined,
          description:
            args.input.description === null
              ? null
              : args.input.description ?? undefined,
          logoUrl:
            args.input.logoUrl === null ? null : args.input.logoUrl ?? undefined,
          isActive: args.input.isActive ?? undefined,
          homeVenueId:
            args.input.homeVenueId === null
              ? null
              : args.input.homeVenueId
                ? String(args.input.homeVenueId)
                : undefined,
        },
      });
    },
  }),

  deleteTeam: t.boolean({
    description:
      "Soft-delete a team (isActive=false). Blocks if the team has active competition participation.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const team = await ctx.prisma.team.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      ensure(ctx.ability, "delete", {
        ...team,
        __caslSubjectType__: "Team",
      });
      // Block if the team is in any non-final competition
      const live = await ctx.prisma.competitionApplication.findFirst({
        where: {
          teamId: team.id,
          status: "APPROVED",
          competition: {
            status: { in: ["OPEN_FOR_APPLICATIONS", "APPLICATIONS_CLOSED", "ONGOING"] },
          },
        },
      });
      if (live) {
        throw new GraphQLError(
          "Cannot delete a team that's in an ongoing competition.",
          { extensions: { code: "TEAM_IN_USE" } },
        );
      }
      await ctx.prisma.team.update({
        where: { id: team.id },
        data: { isActive: false },
      });
      return true;
    },
  }),

  addTeamMember: t.prismaField({
    type: "TeamMember",
    description:
      "Round-28 — admin-only direct add. Captains MUST use inviteToTeam → respondToInvitation; this path is reserved for SUPER_ADMIN + seed.",
    args: {
      teamId: t.arg.id({ required: true }),
      userId: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      if (ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError(
          "Direct add is disabled — invite the player instead",
          { extensions: { code: "FORBIDDEN" } },
        );
      }
      const team = await ctx.prisma.team.findUniqueOrThrow({
        where: { id: String(args.teamId) },
      });
      return ctx.prisma.teamMember.create({
        ...query,
        data: { teamId: team.id, userId: String(args.userId) },
      });
    },
  }),

  removeTeamMember: t.boolean({
    args: {
      teamId: t.arg.id({ required: true }),
      userId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const team = await ctx.prisma.team.findUniqueOrThrow({
        where: { id: String(args.teamId) },
      });
      ensure(ctx.ability, "update", {
        ...team,
        __caslSubjectType__: "Team",
      });
      // The captain can't be removed — that would orphan team.captainId and
      // break every captaincy-gated flow (apply, score submission, invites).
      // Captaincy must be transferred first.
      if (String(args.userId) === team.captainId) {
        throw new GraphQLError(
          "The team captain can't be removed. Transfer captaincy to another member first.",
          { extensions: { code: "CAPTAIN_CANNOT_BE_REMOVED" } },
        );
      }
      // deleteMany (not delete) so a double-click / already-removed member is
      // a no-op instead of a P2025 crash.
      await ctx.prisma.teamMember.deleteMany({
        where: { teamId: team.id, userId: String(args.userId) },
      });
      return true;
    },
  }),
}));
