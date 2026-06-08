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
  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <CitySelector city={city} />
      <div className="flex items-center gap-3">
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
