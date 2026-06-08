import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { CreateTeamInput } from "../types/team";
import { ensure, requireUser } from "@/lib/casl/guard";

const UpdateTeamInput = builder.inputType("UpdateTeamInput", {
  fields: (t) => ({
    name: t.string(),
    description: t.string(),
    logoUrl: t.string(),
    isActive: t.boolean(),
  }),
});

builder.mutationFields((t) => ({
  createTeam: t.prismaField({
    type: "Team",
    description: "Create a team. Viewer becomes the captain.",
    args: { input: t.arg({ type: CreateTeamInput, required: true }) },
    resolve: (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      if (
        ctx.viewer.role !== "TEAM_CAPTAIN" &&
        ctx.viewer.role !== "ORGANIZER" &&
        ctx.viewer.role !== "SUPER_ADMIN"
      ) {
        throw new GraphQLError(
          "Only captains, organizers, or admins can create teams",
          { extensions: { code: "FORBIDDEN" } },
        );
      }
      return ctx.prisma.team.create({
        ...query,
        data: {
          name: args.input.name,
          slug: args.input.slug,
          logoUrl: args.input.logoUrl ?? null,
          description: args.input.description ?? null,
          captainId: ctx.viewer.id,
          members: { create: { userId: ctx.viewer.id } },
        },
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
    args: {
      teamId: t.arg.id({ required: true }),
      userId: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const team = await ctx.prisma.team.findUniqueOrThrow({
        where: { id: String(args.teamId) },
      });
      ensure(ctx.ability, "update", {
        ...team,
        __caslSubjectType__: "Team",
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
      await ctx.prisma.teamMember.delete({
        where: {
          teamId_userId: {
            teamId: team.id,
            userId: String(args.userId),
          },
        },
      });
      return true;
    },
  }),
}));
