"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Asterisk, Home, Target, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPrefixes: string[];
};

const ITEMS: Item[] = [
  { href: "/", label: "Hub", icon: <Target className="size-5" />, matchPrefixes: ["/", "/competitions"] },
  { href: "/teams", label: "Teams", icon: <Users className="size-5" />, matchPrefixes: ["/teams"] },
  { href: "/rankings", label: "Rank", icon: <Trophy className="size-5" />, matchPrefixes: ["/rankings"] },
  { href: "/venues", label: "Venues", icon: <Home className="size-5" />, matchPrefixes: ["/venues"] },
  { href: "/community", label: "Talk", icon: <Asterisk className="size-5" />, matchPrefixes: ["/community"] },
];

function isActive(path: string, item: Item): boolean {
  if (path === item.href) return true;
  return item.matchPrefixes.some((p) =>
    p === "/" ? path === "/" : path.startsWith(p),
  );
}

/**
 * Bottom-tab nav for phones — replaces the desktop sidebar which is
 * `hidden md:flex`. Sticks to the bottom on viewports < md so primary nav is
 * always one tap away.
 */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
      data-testid="mobile-nav"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                data-active={active || undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium uppercase tracking-wider",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
