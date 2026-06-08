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
        "relative flex flex-col gap-3 border-b border-border bg-card/40 px-8 py-8 overflow-hidden",
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
