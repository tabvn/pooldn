import type { ReactNode } from "react";
import { DetailHero } from "@/components/layout/detail-hero";
import { TabNav } from "@/components/layout/tab-nav";
import { requireViewer } from "@/lib/auth/server";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await requireViewer({ next: "/settings" });

  return (
    <div className="flex flex-col">
      {/* Round-74 — use the app's compact DetailHero (teams / venues / profile)
          instead of the old full-bleed PageTitle band for a consistent header. */}
      <DetailHero
        title="Edit Profile"
        meta={<span>@{viewer.username}</span>}
      />
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 md:px-10 md:pt-6">
        <TabNav
          items={[
            { href: "/settings", label: "Profile" },
            { href: "/settings/account", label: "Account" },
            { href: "/settings/notifications", label: "Notifications" },
          ]}
          fullWidth
        />
      </div>
      <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-10 md:py-6">
        {children}
      </div>
    </div>
  );
}
