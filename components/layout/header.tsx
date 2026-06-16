"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppShell } from "./app-shell";
import { CitySelector } from "./city-selector";
import { NotificationBell } from "./notification-bell";
import { ViewerMenu } from "./viewer-menu";

export type HeaderProps = {
  city?: string;
  viewerName?: string | null;
  viewerUsername?: string | null;
  viewerAvatarUrl?: string | null;
};

export function Header({
  city = "Da Nang, Vietnam",
  viewerName = null,
  viewerUsername = null,
  viewerAvatarUrl = null,
}: HeaderProps) {
  const signedIn = !!viewerName;
  const { scrolled } = useAppShell();
  return (
    <header
      data-scrolled={scrolled || undefined}
      // Round-50 — kept the header height STATIC so scrolling never triggers
      // a layout reflow under the sticky bar. The "condense" feel comes from
      // a vertical-padding transition (cheap, composited) plus a hairline
      // shadow that fades in. Earlier we were animating `height` + `padding`
      // simultaneously over 200ms, which forced the entire scroll area to
      // re-layout for the duration of the transition and felt laggy.
      className={cn(
        "sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card/95 backdrop-blur",
        "h-[64px] transition-[padding,box-shadow] duration-150 ease-out will-change-[padding]",
        scrolled
          ? "px-3 py-1 shadow-sm md:px-4"
          : "px-3 py-3 md:gap-4 md:px-6",
      )}
    >
      {/* Mobile logo + city — sidebar is hidden on small screens so the
          header carries the brand mark. */}
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 md:hidden"
        aria-label="PoolDN home"
      >
        <span className="relative inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-black text-xs">
          <span className="absolute inset-0 rounded-full ring-2 ring-primary/30" />
          8
        </span>
      </Link>
      <div className="shrink-0">
        <CitySelector city={city} />
      </div>
      <div className="flex items-center gap-2 md:gap-3 ml-auto">
        {signedIn ? (
          <>
            <NotificationBell signedIn={signedIn} />
            <ViewerMenu
              viewerName={viewerName}
              viewerUsername={viewerUsername}
              viewerAvatarUrl={viewerAvatarUrl}
            />
          </>
        ) : (
          // Round-47 — Figma guest header: explicit Log In + Create Account
          // CTAs, not just the small text link the ViewerMenu used to render.
          <>
            <Link href="/sign-in">
              <Button size="sm" data-testid="header-login">
                Log In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" variant="outline" data-testid="header-signup">
                Create Account
              </Button>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
