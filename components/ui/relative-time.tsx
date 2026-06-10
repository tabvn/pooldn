"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";

/**
 * Renders a timestamp as "N ago" relative to now using date-fns'
 * formatDistanceToNowStrict so the units stay i18n-ready and consistent
 * across the app. Client-only — the server would render "0 seconds ago"
 * which would hydrate to "3 months ago" and trigger a mismatch. Empty
 * span on the server, fills in on mount, re-renders every 60s so "just
 * now" doesn't get stuck forever.
 *
 * Variants:
 *  - "short" (default) → "3 mo ago" (date-fns abbreviated unit roundup)
 *  - "long"            → "3 months ago" (date-fns full unit)
 */
export function RelativeTime({
  value,
  prefix = "",
  variant = "long",
}: {
  value: string | Date | null | undefined;
  prefix?: string;
  variant?: "short" | "long";
}) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    if (!value) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText("");
      return;
    }
    const target = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(target.getTime())) {
      setText("");
      return;
    }
    const render = () =>
      setText(
        formatDistanceToNowStrict(target, { addSuffix: true }),
      );
    render();
    const interval = setInterval(render, 60_000);
    return () => clearInterval(interval);
  }, [value, variant]);

  return (
    <span
      title={
        value
          ? (value instanceof Date ? value : new Date(value)).toLocaleString()
          : undefined
      }
    >
      {text ? `${prefix}${text}` : ""}
    </span>
  );
}
