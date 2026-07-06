"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Access cookie lives 15 min; refresh comfortably ahead of that so it never
// lapses while the tab is open.
const REFRESH_EVERY_MS = 10 * 60 * 1000;

/**
 * Round-64 — proactive session keepalive.
 *
 * The access cookie lives 15 minutes; the refresh cookie 30 days. The Apollo
 * link only refreshes reactively (on a GraphQL UNAUTHORIZED), so an idle user's
 * access token silently expires and the SSR-rendered header keeps showing their
 * avatar (stale) until something forces a re-render — it looks like they're
 * still logged in when the session is effectively gone.
 *
 * This pings /api/auth/refresh before the access token can expire (plus on tab
 * focus and on cold load), rotating the cookie pair so the session stays alive
 * for the full 30-day refresh window. When the refresh finally fails (logged
 * out elsewhere / refresh expired), it refreshes the route so the header flips
 * to the signed-out state — no more ghost avatar.
 *
 * Rendered for everyone (not just signed-in SSR renders): on a cold load after
 * the access token expired, SSR paints the guest header, but a valid refresh
 * cookie lets this recover the session and re-sync.
 */
export function SessionKeepalive({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  // Best guess at whether a live session exists right now.
  const hasSession = useRef(signedIn);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stopTimer = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    async function ping() {
      let status = 0;
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
        status = res.status;
      } catch {
        // Network blip — leave state as-is; the interval will retry.
        return;
      }
      if (cancelled) return;

      if (status >= 200 && status < 300) {
        // Session (still) alive. If the page rendered signed-out because the
        // access token had expired on a cold load, re-sync so the header
        // shows the user again.
        if (!hasSession.current) {
          hasSession.current = true;
          router.refresh();
        }
        if (!timer) {
          timer = setInterval(() => void ping(), REFRESH_EVERY_MS);
        }
      } else if (status === 401 || status === 403) {
        // No valid refresh token → genuinely signed out. Flip the UI if we
        // believed we were signed in, then stop pinging.
        const wasSignedIn = hasSession.current;
        hasSession.current = false;
        stopTimer();
        if (wasSignedIn) router.refresh();
      }
      // 5xx / other transient statuses: leave any running interval in place.
    }

    function onFocus() {
      // Only re-ping for an active session (avoids guests spamming on focus);
      // catches tabs reopened after the access token expired.
      if (hasSession.current && document.visibilityState === "visible") {
        void ping();
      }
    }

    void ping();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      stopTimer();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [router]);

  return null;
}
