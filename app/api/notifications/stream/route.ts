import { readSessionCookie, verifySessionToken } from "@/lib/auth/jwt";
import { subscribeNotifications } from "@/lib/notifications/pubsub";

export const dynamic = "force-dynamic";
// SSE requires Node streaming — opt out of static / edge.
export const runtime = "nodejs";

const ENCODER = new TextEncoder();
function sse(event: string, data: unknown) {
  return ENCODER.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Server-Sent Events endpoint for realtime notification nudges.
 *
 * Auth: pooldn_session cookie. The stream emits a "ping" event whenever a
 * notification fires for the viewer (see lib/notifications/pubsub.ts). A
 * keepalive comment every 30s keeps middleware proxies from idling out the
 * socket.
 *
 * The client reads it via lib/notifications/use-notification-stream.ts and
 * refetches the unread count + recent list on each ping — cheap, no extra
 * payload to model server-side.
 */
export async function GET(request: Request) {
  const token = readSessionCookie(request.headers.get("cookie"));
  const claims = token ? await verifySessionToken(token) : null;
  if (!claims) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = claims.sub;

  let unsubscribe: (() => void) | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sse("hello", { userId }));
      unsubscribe = subscribeNotifications(userId, (payload) => {
        try {
          controller.enqueue(sse("ping", payload));
        } catch {
          // already closed
        }
      });
      keepalive = setInterval(() => {
        try {
          controller.enqueue(ENCODER.encode(": keepalive\n\n"));
        } catch {
          // ignore
        }
      }, 30_000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (keepalive) clearInterval(keepalive);
    },
  });

  request.signal.addEventListener("abort", () => {
    if (unsubscribe) unsubscribe();
    if (keepalive) clearInterval(keepalive);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
