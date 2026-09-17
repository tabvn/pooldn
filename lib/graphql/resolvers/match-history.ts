import { builder } from "../builder";
import {
  isPast,
  playerMatches,
  type PlayerMatchRow,
} from "@/lib/services/match-history.service";

/**
 * Round-90 — match history on a player's profile, past and scheduled.
 *
 * Works the same for a real account and for an unclaimed placeholder: both are
 * rostered, both appear in frames. When a placeholder is merged into an
 * account, the underlying rows move with it (see shell-merge.service), so the
 * claimant's profile simply starts listing those matches — nothing here needs
 * to know a merge happened.
 */

const MatchSideEnum = builder.enumType("MatchSide", {
  values: ["HOME", "AWAY"] as const,
  description: "Which side of the match the player was on.",
});

const PlayerMatch = builder
  .objectRef<PlayerMatchRow>("PlayerMatch")
  .implement({
    description:
      "One match from a player's perspective: the match itself, the side they're on, and their own frame tally when they've played.",
    fields: (t) => ({
      side: t.expose("side", { type: MatchSideEnum, nullable: true }),
      // False for a fixture their team is playing that they haven't been
      // named in yet — still theirs, but nothing to show a score for.
      played: t.exposeBoolean("played"),
      framesPlayed: t.exposeInt("framesPlayed"),
      framesWon: t.exposeInt("framesWon"),
      match: t.prismaField({
        type: "Match",
        resolve: (query, row, _args, ctx) =>
          ctx.prisma.match.findUniqueOrThrow({
            ...query,
            where: { id: row.matchId },
          }),
      }),
    }),
  });

builder.prismaObjectFields("User", (t) => ({
  upcomingMatches: t.field({
    type: [PlayerMatch],
    description:
      "Matches still to play — soonest first. Includes fixtures their team has scheduled before any lineup exists.",
    args: { first: t.arg.int() },
    resolve: async (u, args, ctx) => {
      const rows = await playerMatches(ctx.prisma, u.id);
      return rows
        .filter((r) => !isPast(r))
        .sort((a, b) => {
          const av = a.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bv = b.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return av - bv;
        })
        .slice(0, Math.min(Math.max(args.first ?? 5, 1), 500));
    },
  }),
  pastMatches: t.field({
    type: [PlayerMatch],
    description:
      "Matches already played (or cancelled), most recent first, with the player's own frame tally.",
    args: { first: t.arg.int() },
    resolve: async (u, args, ctx) => {
      const rows = await playerMatches(ctx.prisma, u.id);
      return rows
        .filter(isPast)
        .slice(0, Math.min(Math.max(args.first ?? 10, 1), 500));
    },
  }),
  playedMatchCount: t.int({
    description: "How many matches this player has actually appeared in.",
    resolve: async (u, _args, ctx) => {
      const rows = await playerMatches(ctx.prisma, u.id);
      return rows.filter((r) => r.played && isPast(r)).length;
    },
  }),
}));
