import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { pubsub } from "../pubsub";

/**
 * Real-time match + competition feeds.
 *
 *  - `matchUpdated(id)`              fires when ANYTHING about that match
 *                                    changes server-side (frame recorded,
 *                                    score submitted, completed, forfeited).
 *                                    Resolves the up-to-date Match row so the
 *                                    client can render the new scoreboard
 *                                    without a separate refetch.
 *
 *  - `competitionStandingsUpdated(id)` fires every time standings are
 *                                    recomputed for that competition. Returns
 *                                    the fresh standings list ordered by
 *                                    position. Hook this onto the live
 *                                    standings table.
 *
 * Auth: subscriptions are public — they only stream data the viewer would
 * already be allowed to see at the resolver layer (Match & Standing rows are
 * publicly readable via CASL).
 */

builder.subscriptionFields((t) => ({
  matchUpdated: t.prismaField({
    type: "Match",
    description:
      "Streams the full Match row every time the match changes (frame recorded, score submitted, completed, forfeited).",
    args: { id: t.arg.id({ required: true }) },
    subscribe: (_root, args) => pubsub.subscribe(`match:${String(args.id)}`),
    resolve: async (query, _payload, args, ctx) =>
      ctx.prisma.match.findUniqueOrThrow({
        ...query,
        where: { id: String(args.id) },
      }),
  }),

  competitionStandingsUpdated: t.prismaField({
    type: ["Standing"],
    description:
      "Streams the standings list for a competition each time they're recomputed.",
    args: { competitionId: t.arg.id({ required: true }) },
    subscribe: (_root, args) =>
      pubsub.subscribe(`competition:${String(args.competitionId)}`),
    resolve: async (query, _payload, args, ctx) =>
      ctx.prisma.standing.findMany({
        ...query,
        where: { competitionId: String(args.competitionId) },
        orderBy: [
          { position: "asc" },
          { points: "desc" },
          { pointDiff: "desc" },
        ],
      }),
  }),

  notificationReceived: t.prismaField({
    type: "Notification",
    nullable: true,
    description:
      "Streams Notification rows as they land in the viewer's inbox. Requires a signed-in viewer; closes if not authenticated. Returns null on the rare race where the row was deleted between publish and subscribe — clients should ignore null payloads.",
    subscribe: (_root, _args, ctx) => {
      if (!ctx.viewer) {
        throw new GraphQLError("Sign in to subscribe to notifications", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }
      return pubsub.subscribe(`notif:${ctx.viewer.id}`);
    },
    resolve: async (query, payload, _args, ctx) => {
      if (!ctx.viewer) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }
      return ctx.prisma.notification.findUnique({
        ...query,
        where: { id: payload.notificationId },
      });
    },
  }),
}));
