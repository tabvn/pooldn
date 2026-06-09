"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAppShell } from "./app-shell";
import { CitySelector } from "./city-selector";
import { GlobalSearch } from "./global-search";
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
      className={cn(
        "sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card/95 backdrop-blur transition-[height,padding] duration-200 ease-out",
        scrolled
          ? "h-[56px] px-3 md:px-4"
          : "h-[72px] px-3 md:gap-4 md:px-6",
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
      <div className="hidden md:block">
        <CitySelector city={city} />
      </div>
      <div
        className={cn(
          "flex flex-1 justify-center px-2 md:px-4",
          scrolled && "md:px-2",
        )}
      >
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-2 md:gap-3 ml-auto">
        {signedIn ? <NotificationBell signedIn={signedIn} /> : null}
        <ViewerMenu
          viewerName={viewerName}
          viewerUsername={viewerUsername}
          viewerAvatarUrl={viewerAvatarUrl}
        />
      </div>
    </header>
  );
}
