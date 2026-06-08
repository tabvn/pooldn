"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribe to the /api/notifications/stream SSE endpoint while the viewer
 * is signed in. Each "ping" event fires `onEvent` — typically the caller
 * refetches the unread count + recent list.
 *
 * Reconnects with exponential backoff on error. Caller's `onEvent` is held
 * in a ref so changing it doesn't re-open the socket.
 */
export function useNotificationStream(
  enabled: boolean,
  onEvent: () => void,
): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let es: EventSource | null = null;
    let stopped = false;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      if (stopped) return;
      es = new EventSource("/api/notifications/stream");
      es.addEventListener("ping", () => {
        retry = 0;
        handlerRef.current();
      });
      es.addEventListener("error", () => {
        if (es) {
          es.close();
          es = null;
        }
        if (stopped) return;
        // Backoff: 1s, 2s, 4s, 8s, capped at 30s.
        retry = Math.min(retry + 1, 5);
        const delay = Math.min(30_000, 1000 * 2 ** (retry - 1));
        retryTimer = setTimeout(open, delay);
      });
    };
    open();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (es) es.close();
    };
  }, [enabled]);
}
