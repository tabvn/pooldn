"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { Tooltip } from "@base-ui-components/react/tooltip";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gavel,
  Lightbulb,
  Mail,
  MapPin,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import { useAppShell } from "./app-shell";
import {
  BallMark,
  CommunityIcon,
  HelpIcon,
  PoolhubIcon,
  SuggestIcon,
  TeamsIcon,
  VenuesIcon,
  Wordmark,
} from "./sidebar-icons";

/**
 * Wraps a sidebar item in a Base UI Tooltip when the sidebar is collapsed,
 * showing the item's label to the right of the icon. Uses a portal so the
 * popup escapes the sidebar's `overflow-y-auto` clip.
 */
function CollapsedTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<span className="block" />}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="right" sideOffset={8} align="center">
          <Tooltip.Popup className="z-50 rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

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

function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true;
  if (!item.matchPrefixes) return false;
  return item.matchPrefixes.some((p) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p),
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: viewerData } = useQuery(ViewerQuery, {
    fetchPolicy: "cache-first",
    errorPolicy: "ignore",
  });
  const isAdmin = viewerData?.viewer?.role === "SUPER_ADMIN";
  const { collapsed, toggleCollapsed } = useAppShell();

  return (
    <Tooltip.Provider delay={150} closeDelay={0}>
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "hidden md:flex h-[100dvh] shrink-0 flex-col gap-2 border-r border-border bg-card py-6 transition-[width] duration-200 ease-out overflow-y-auto",
        collapsed ? "w-[68px] px-2" : "w-[260px] px-4",
      )}
    >
      {/* Logo lockup — 8-ball mark + "POOLDN" wordmark from Figma. */}
      <CollapsedTooltip label="PoolDN" enabled={collapsed}>
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 mb-6",
            collapsed ? "justify-center px-0" : "px-2",
          )}
        >
          <BallMark className="size-[30px] shrink-0 text-primary" />
          {!collapsed ? (
            <>
              <Wordmark className="h-[12px] w-auto text-primary" />
              <span className="ml-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Beta
              </span>
            </>
          ) : null}
        </Link>
      </CollapsedTooltip>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        data-testid="sidebar-collapse-toggle"
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors",
          collapsed ? "self-center -mt-3" : "self-end -mt-3",
        )}
      >
        {collapsed ? (
          <ChevronRight className="size-3.5" />
        ) : (
          <ChevronLeft className="size-3.5" />
        )}
      </button>

      {/* Primary nav */}
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item);
          return (
            <CollapsedTooltip
              key={item.href}
              label={item.label}
              enabled={collapsed}
            >
              <Link
                href={item.href}
                data-active={active || undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2" : "px-3",
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
                {!collapsed ? item.label : null}
              </Link>
            </CollapsedTooltip>
          );
        })}
        {isAdmin ? (
          <AdminSubmenu pathname={pathname} collapsed={collapsed} />
        ) : null}
      </nav>

      {/* Round-47 — Mobile app promo redesigned to match Figma:
          - 8-ball sits in its own raised dark tile above the title,
            instead of inline next to it
          - Tighter lockup, lime title color
          - Hidden when sidebar is collapsed (no space for it) */}
      {!collapsed ? (
        <div
          className="mt-auto overflow-hidden rounded-xl p-4 shadow-lg"
          style={{
            background:
              "linear-gradient(135deg, #9810fa 0%, #4a106e 55%, #1c2280 100%)",
          }}
        >
          <div className="mb-3 inline-flex size-12 items-center justify-center rounded-lg bg-black/30 ring-1 ring-white/10">
            <span className="relative inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-black text-sm">
              <span
                aria-hidden
                className="absolute inset-0 rounded-full ring-2 ring-primary/30"
              />
              8
            </span>
          </div>
          <div className="text-sm font-bold text-primary">
            PoolDN Mobile App
          </div>
          <p className="mt-1 text-xs text-white/80 leading-snug">
            Coming Soon
            <br />
            on Android and iOS
          </p>
        </div>
      ) : (
        <div className="mt-auto" />
      )}

      {/* Utility links — labels hidden in collapsed mode */}
      <div className="flex flex-col gap-0.5 pt-3 mt-1">
        <CollapsedTooltip label="Suggest a Feature" enabled={collapsed}>
          <Link
            href="/feedback"
            className={cn(
              "flex items-center gap-2 py-1.5 text-xs text-muted-foreground hover:text-foreground",
              collapsed ? "justify-center px-2" : "px-3",
            )}
          >
            <SuggestIcon className="size-4" />
            {!collapsed ? "Suggest a Feature" : null}
          </Link>
        </CollapsedTooltip>
        <CollapsedTooltip label="Need Help?" enabled={collapsed}>
          <Link
            href="/help"
            className={cn(
              "flex items-center gap-2 py-1.5 text-xs text-muted-foreground hover:text-foreground",
              collapsed ? "justify-center px-2" : "px-3",
            )}
          >
            <HelpIcon className="size-4" />
            {!collapsed ? "Need Help?" : null}
          </Link>
        </CollapsedTooltip>
      </div>
    </aside>
    </Tooltip.Provider>
  );
}

/**
 * Admin submenu — expandable Admin item with nested links to the various
 * admin surfaces (Feedback inbox, Reports queue, Score submissions admin,
 * Player edit search). Auto-expands when the viewer is on any /admin route.
 */
type AdminItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

// Round-47 — icon size bumped from 3.5 → 5 to match the main NAV. Also
// diversified the glyphs: Security and Moderation were both ShieldCheck;
// Feedback and Outbox were both Inbox. Pick distinct, semantically
// appropriate icons so a quick glance disambiguates them.
const ADMIN_ITEMS: AdminItem[] = [
  {
    href: "/admin/feedback",
    label: "Feedback",
    icon: <Lightbulb className="size-5" />,
  },
  {
    href: "/admin/score-submissions",
    label: "Score submissions",
    icon: <Trophy className="size-5" />,
  },
  {
    href: "/admin/locations",
    label: "Locations",
    icon: <MapPin className="size-5" />,
  },
  {
    href: "/admin/moderation",
    label: "Moderation",
    icon: <Gavel className="size-5" />,
  },
  {
    href: "/admin/security",
    label: "Security log",
    icon: <ShieldCheck className="size-5" />,
  },
  {
    href: "/admin/outbox",
    label: "Email outbox",
    icon: <Mail className="size-5" />,
  },
];

function AdminSubmenu({
  pathname,
  collapsed = false,
}: {
  pathname: string;
  collapsed?: boolean;
}) {
  const onAdmin = pathname.startsWith("/admin");
  const [open, setOpen] = useState(onAdmin && !collapsed);
  // Keep state in sync if the viewer navigates into /admin from elsewhere.
  useEffect(() => {
    if (onAdmin && !collapsed) setOpen(true);
  }, [onAdmin, collapsed]);

  // Collapsed sidebar: render the admin items inline as icons (no submenu).
  if (collapsed) {
    return (
      <div className="mt-1 border-t border-border/40 pt-2 flex flex-col gap-1">
        {ADMIN_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <CollapsedTooltip key={item.href} label={item.label} enabled>
              <Link
                href={item.href}
                data-active={active || undefined}
                className={cn(
                  "flex items-center justify-center rounded-md px-2 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {item.icon}
              </Link>
            </CollapsedTooltip>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-1 border-t border-border/40 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="admin-submenu"
        data-testid="sidebar-admin-toggle"
        className={cn(
          "relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          onAdmin
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        )}
      >
        {onAdmin ? (
          <span
            aria-hidden
            className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary"
          />
        ) : null}
        <ShieldCheck className="size-4 shrink-0" />
        <span className="flex-1 text-left">Admin</span>
        {open ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
      </button>
      {open ? (
        <ul
          id="admin-submenu"
          className="mt-1 ml-3 border-l border-border/40 pl-3 space-y-0.5"
        >
          {ADMIN_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-active={active || undefined}
                  data-testid={`sidebar-admin-${item.label.toLowerCase().replace(/\s+/g, "-")}-link`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
