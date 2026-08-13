import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { DetailHero } from "@/components/layout/detail-hero";
import { TabNav } from "@/components/layout/tab-nav";

/**
 * Round-74 — "About" hub in the sidebar footer. Groups the app blurb with the
 * legal + support pages (Privacy, Terms, Help) as sibling tabs so they read as
 * one section instead of scattered standalone routes. The old top-level
 * /privacy, /terms and /help URLs redirect here to preserve external links.
 */
export default function AboutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <DetailHero
        title="About PoolDN"
        meta={
          <span className="inline-flex items-center gap-2">
            <Info className="size-3.5" /> Built by pool enthusiasts
          </span>
        }
      />
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 md:px-10 md:pt-6">
        <TabNav
          items={[
            { href: "/about", label: "About" },
            { href: "/about/privacy", label: "Privacy Policy" },
            { href: "/about/terms", label: "Terms" },
            { href: "/about/help", label: "Help" },
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
