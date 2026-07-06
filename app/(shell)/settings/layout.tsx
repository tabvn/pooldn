import type { ReactNode } from "react";
import { User } from "lucide-react";
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
      <div className="mx-auto w-full max-w-5xl px-6 pt-6 md:px-10">
        <TabNav
          items={[
            { href: "/settings", label: "Profile" },
            { href: "/settings/account", label: "Account" },
            { href: "/settings/notifications", label: "Notifications" },
          ]}
          fullWidth
        />
      </div>
      <div className="mx-auto w-full max-w-5xl px-6 py-6 md:px-10">
        {children}
      </div>
    </div>
  );
}
