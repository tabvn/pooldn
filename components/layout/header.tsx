"use client";

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
      <div className="hidden md:block">
        <CitySelector city={city} />
      </div>
      <div
        className={cn(
          "hidden flex-1 justify-center px-2 sm:flex md:px-4",
          scrolled && "sm:px-2 md:px-2",
        )}
      >
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-2 md:gap-3 ml-auto">
        <NotificationBell signedIn={signedIn} />
        <ViewerMenu
          viewerName={viewerName}
          viewerUsername={viewerUsername}
          viewerAvatarUrl={viewerAvatarUrl}
        />
      </div>
    </header>
  );
}
