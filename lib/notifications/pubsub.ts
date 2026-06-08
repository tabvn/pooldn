import { EventEmitter } from "node:events";

/**
 * In-process pub/sub for notification fan-out.
 *
 * Every NotificationService.create() call publishes a per-user "ping" so
 * connected SSE listeners (lib/notifications/use-notification-stream client +
 * /api/notifications/stream server) refresh their badge and inbox without
 * waiting for the 30s poll.
 *
 * Single-process scope is fine for the current single-node deploy; swap the
 * underlying emitter for Postgres LISTEN/NOTIFY (or Redis) when we go
 * multi-instance. The `publish` / `subscribe` shape doesn't have to change.
 *
 * The EventEmitter is hung off `globalThis` so dev-mode hot reload doesn't
 * orphan existing listeners.
 */
type Payload = {
  userId: string;
  notificationId?: string;
  type?: string;
};

const KEY = Symbol.for("pooldn.notifications.pubsub");
type GlobalWithBus = typeof globalThis & {
  [KEY]?: EventEmitter;
};
const g = globalThis as GlobalWithBus;
const bus: EventEmitter = g[KEY] ?? new EventEmitter();
// EventEmitter defaults to 10 listeners — bump it; one per active SSE socket.
bus.setMaxListeners(1000);
g[KEY] = bus;

export function publishNotification(payload: Payload): void {
  bus.emit(`user:${payload.userId}`, payload);
  bus.emit("user:*", payload);
}

export function subscribeNotifications(
  userId: string,
  handler: (p: Payload) => void,
): () => void {
  const channel = `user:${userId}`;
  bus.on(channel, handler);
  return () => bus.off(channel, handler);
}
