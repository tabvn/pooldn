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
  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:gap-4 md:px-6">
      <div className="hidden md:block">
        <CitySelector city={city} />
      </div>
      {/* Search shrinks on tablet, hides on small phones (use /search via the
          rest of the UI; bringing search back via a tap target is a future
          improvement). */}
      <div className="hidden flex-1 justify-center px-2 sm:flex md:px-4">
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
