import * as React from "react";
import { cn } from "@/lib/utils";

export function PageTitle({
  title,
  eyebrow,
  description,
  actions,
  meta,
  bannerUrl,
  className,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  bannerUrl?: string | null;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative flex flex-col gap-3 border-b border-border px-4 md:px-8 py-6 md:py-8 overflow-hidden",
        // Round-45 — when there's no banner image, fall back to a subtle
        // brand gradient instead of a flat band. A small decorative ring
        // sits at the top-right for visual hierarchy.
        bannerUrl ? "" : "bg-card/40 bg-gradient-to-br from-primary/15 via-card/40 to-info/10",
        className,
      )}
      style={
        bannerUrl
          ? {
              backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.75) 100%), url('${bannerUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {!bannerUrl ? (
        <span
          aria-hidden
          className="absolute -top-16 -right-16 size-48 rounded-full bg-primary/15 blur-3xl pointer-events-none"
        />
      ) : null}
      {eyebrow ? (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          {eyebrow}
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-primary">{title}</h1>
          {description ? (
            <div className="text-sm text-muted-foreground max-w-2xl">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {meta}
        </div>
      ) : null}
    </section>
  );
}
