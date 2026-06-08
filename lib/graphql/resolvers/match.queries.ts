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
      });
      if (!m) return null;
      // Visibility piggybacks on Competition visibility — if you can read the
      // competition, you can read its matches.
      if (!ctx.ability.can("read", "Competition")) return null;
      return m;
    },
  }),
}));
