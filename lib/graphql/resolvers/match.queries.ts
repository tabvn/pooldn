import { accessibleBy } from "@casl/prisma";
import { builder } from "../builder";

builder.queryFields((t) => ({
  match: t.prismaField({
    type: "Match",
    nullable: true,
    description: "Look up a single match by id.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      const m = await ctx.prisma.match.findUnique({
        ...query,
        where: { id: String(args.id) },
        // matchdayId drives the competition read gate below.
      });
      if (!m) return null;
      // Visibility piggybacks on Competition visibility. The bare
      // `can("read", "Competition")` form skips the isPublic/status
      // conditions (no instance to test), so it let anyone read matches of
      // a draft/private competition. Gate on the concrete competition row
      // via accessibleBy instead.
      const readable = await ctx.prisma.competition.findFirst({
        where: {
          AND: [
            accessibleBy(ctx.ability, "read").ofType("Competition"),
            { matchdays: { some: { id: m.matchdayId } } },
          ],
        },
        select: { id: true },
      });
      if (!readable) return null;
      return m;
    },
  }),
}));
