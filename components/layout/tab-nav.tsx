"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type TabNavItem = {
  href: string;
  label: string;
};

export function TabNav({ items }: { items: TabNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="inline-flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== pathname.split("/").slice(0, -1).join("/") &&
            pathname === item.href);
        // simple "is current path" match — exact match works since tabs
        // are sibling routes under the same parent.
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            data-selected={isActive || undefined}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
