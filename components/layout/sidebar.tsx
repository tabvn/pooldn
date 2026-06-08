"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Asterisk,
  Home,
  LifeBuoy,
  Lightbulb,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPrefixes?: string[];
};

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Poolhub",
    icon: <Target className="size-4" />,
    matchPrefixes: ["/", "/competitions"],
  },
  {
    href: "/teams",
    label: "Teams",
    icon: <Users className="size-4" />,
    matchPrefixes: ["/teams"],
  },
  {
    href: "/venues",
    label: "Venues",
    icon: <Home className="size-4" />,
    matchPrefixes: ["/venues"],
  },
  {
    href: "/community",
    label: "Community",
    icon: <Asterisk className="size-4" />,
    matchPrefixes: ["/community"],
  },
];

function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true;
  if (!item.matchPrefixes) return false;
  return item.matchPrefixes.some((p) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p),
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-[260px] shrink-0 flex-col gap-2 border-r border-border bg-card px-4 py-6">
      {/* Logo lockup */}
      <Link href="/" className="flex items-center gap-2 px-2 mb-6">
        <span className="relative inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-black text-sm">
          <span className="absolute inset-0 rounded-full ring-2 ring-primary/30" />
          8
        </span>
        <span className="text-sm font-bold tracking-tight">Pool DN</span>
        <span className="ml-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
          Beta
        </span>
      </Link>

      {/* Primary nav */}
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active || undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary"
                />
              ) : null}
              <span
                className={cn(
                  "shrink-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile app promo */}
      <div
        className="mt-auto overflow-hidden rounded-xl p-4 text-white shadow-lg"
        style={{
          background:
            "linear-gradient(135deg, #9810fa 0%, #4a106e 55%, #1c2280 100%)",
        }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-black">
            8
          </span>
          <span className="text-sm font-bold">PoolDN Mobile App</span>
        </div>
        <p className="text-xs text-white/80 leading-snug">
          Coming Soon
          <br />
          on Android and iOS
        </p>
      </div>

      {/* Utility links */}
      <div className="flex flex-col gap-0.5 pt-3 mt-1">
        <Link
          href="/feedback"
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Lightbulb className="size-3.5" />
          Suggest a Feature
        </Link>
        <Link
          href="/help"
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <LifeBuoy className="size-3.5" />
          Need Help?
        </Link>
      </div>
    </aside>
  );
}
