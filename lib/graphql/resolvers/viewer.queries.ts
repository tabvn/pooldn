import { builder } from "../builder";

builder.queryFields((t) => ({
  viewer: t.prismaField({
    type: "User",
    nullable: true,
    description: "The currently authenticated user, or null if anonymous.",
    resolve: (query, _root, _args, ctx) => {
      if (!ctx.viewer) return null;
      return ctx.prisma.user.findUnique({
        ...query,
        where: { id: ctx.viewer.id },
      });
    },
  }),
}));
