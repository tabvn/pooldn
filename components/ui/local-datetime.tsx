"use client";

import { useEffect, useState } from "react";

/**
 * Renders a timestamp in the visitor's local timezone + locale.
 *
 * The server can't know the viewer's tz, so it would render in the server's
 * (UTC) tz — that's how "Today's Match" was showing 2:00 AM for a 19:00 UTC
 * kickoff in Vietnam time. We render an empty span on the server and fill
 * it in the browser to avoid a hydration mismatch.
 */
export function LocalDateTime({
  value,
  variant = "datetime",
  prefix = "",
}: {
  value: string | Date | null | undefined;
  variant?: "datetime" | "date" | "time" | "weekday";
  prefix?: string;
}) {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    if (!value) {
      setText("");
      return;
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      setText("");
      return;
    }
    if (variant === "date") {
      setText(
        d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      );
    } else if (variant === "weekday") {
      // Figma matchday header — "Tuesday, Jan 2".
      setText(
        d.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        }),
      );
    } else if (variant === "time") {
      setText(
        d.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    } else {
      setText(
        d.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    }
  }, [value, variant]);

  return (
    <span suppressHydrationWarning data-testid="local-datetime">
      {text ? `${prefix}${text}` : ""}
    </span>
  );
}
