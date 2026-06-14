"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type TabNavItem = {
  href: string;
  label: string;
  /** Optional attention badge — a number renders as a pill, a string renders
   *  the string verbatim. Hide by passing 0/null/undefined. */
  badge?: number | string | null;
};

export function TabNav({
  items,
  fullWidth = false,
}: {
  items: TabNavItem[];
  /** Round-60 — when true the row stretches edge-to-edge and each tab
   *  takes an equal slice (matches the Figma competition tab-list). */
  fullWidth?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "items-center gap-1 rounded-lg bg-secondary/50 p-1",
        fullWidth ? "flex w-full" : "inline-flex",
      )}
    >
      {items.map((item) => {
        // simple "is current path" match — exact match works since tabs
        // are sibling routes under the same parent.
        const isActive = pathname === item.href;
        const showBadge =
          item.badge != null && item.badge !== 0 && item.badge !== "";
        return (
          <Link
            key={item.href}
            href={item.href}
            data-selected={isActive || undefined}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors",
              fullWidth && "flex-1",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {showBadge ? (
              <span
                aria-hidden={typeof item.badge === "number" ? undefined : true}
                aria-label={
                  typeof item.badge === "number"
                    ? `${item.badge} item${item.badge === 1 ? "" : "s"} need review`
                    : undefined
                }
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none",
                  isActive
                    ? "bg-accent-foreground/15 text-accent-foreground"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
