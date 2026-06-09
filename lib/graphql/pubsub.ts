import { createPubSub } from "@graphql-yoga/subscription";

/**
 * GraphQL subscription bus.
 *
 * Topic format:
 *   match:<matchId>          → fires { matchId } whenever a frame is
 *                               recorded, a score is submitted, the match
 *                               completes, or a forfeit lands.
 *   competition:<compId>     → fires { competitionId } whenever standings
 *                               are recomputed for that competition.
 *
 * Single-process scope is fine on a single-node deploy; swap the underlying
 * EventTarget for Postgres LISTEN/NOTIFY (or Redis) when we go multi-instance.
 * `publish` / `subscribe` shapes don't change.
 *
 * The PubSub is hung off `globalThis` so Next.js dev hot-reload doesn't
 * orphan the in-flight subscribers.
 */

type Events = {
  // Each event publishes a typed payload keyed by the topic suffix. Yoga's
  // typed PubSub supports template-key topics so `match:<id>` is one topic
  // per matchId.
  [key: `match:${string}`]: [{ matchId: string }];
  [key: `competition:${string}`]: [{ competitionId: string }];
  // `notif:<userId>` fires per-recipient whenever a Notification row lands
  // in their inbox. The subscription resolver looks the row up by id.
  [key: `notif:${string}`]: [{ notificationId: string; type: string }];
};

const KEY = Symbol.for("pooldn.graphql.pubsub");
type GlobalWithBus = typeof globalThis & {
  [KEY]?: ReturnType<typeof createPubSub<Events>>;
};
const g = globalThis as GlobalWithBus;

export const pubsub: ReturnType<typeof createPubSub<Events>> =
  g[KEY] ?? createPubSub<Events>();
g[KEY] = pubsub;

export function publishMatchUpdate(matchId: string): void {
  pubsub.publish(`match:${matchId}`, { matchId });
}

export function publishCompetitionStandingsUpdate(
  competitionId: string,
): void {
  pubsub.publish(`competition:${competitionId}`, { competitionId });
}

export function publishNotificationReceived(
  userId: string,
  notificationId: string,
  type: string,
): void {
  pubsub.publish(`notif:${userId}`, { notificationId, type });
}
