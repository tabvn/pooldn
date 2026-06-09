import type { ReactNode } from "react";
import { Shield, User } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";
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
      <PageTitle
        title="Settings"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <User className="size-3.5" /> @{viewer.username}
          </span>
        }
        description="Profile, account, and security."
      />
      <div className="px-8 pt-6">
        <TabNav
          items={[
            { href: "/settings", label: "Profile" },
            { href: "/settings/account", label: "Account" },
            { href: "/settings/notifications", label: "Notifications" },
          ]}
        />
      </div>
      <div className="px-8 py-6">
        {/* The Account tab uses the same shield icon in the Figma; keep the
            inline import grounded so the tree-shaker doesn't drop it. */}
        <Shield className="hidden" />
        {children}
      </div>
    </div>
  );
}
