"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CommunityIcon,
  PoolhubIcon,
  TeamsIcon,
  VenuesIcon,
} from "./sidebar-icons";

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPrefixes: string[];
};

// Round-58 — keep in lockstep with the desktop sidebar's NAV (sidebar.tsx):
// same four destinations, same Figma glyphs. Rankings died in Round-54;
// the mobile tab still pointed there and 404'd.
const ITEMS: Item[] = [
  {
    href: "/",
    label: "Poolhub",
    icon: <PoolhubIcon className="size-5" />,
    matchPrefixes: ["/", "/competitions"],
  },
  {
    href: "/teams",
    label: "Teams",
    icon: <TeamsIcon className="size-5" />,
    matchPrefixes: ["/teams"],
  },
  {
    href: "/venues",
    label: "Venues",
    icon: <VenuesIcon className="size-5" />,
    matchPrefixes: ["/venues"],
  },
  {
    href: "/community",
    label: "Community",
    icon: <CommunityIcon className="size-5" />,
    matchPrefixes: ["/community"],
  },
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
      <ul className="grid grid-cols-4">
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
