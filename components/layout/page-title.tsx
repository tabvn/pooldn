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
        "relative flex flex-col gap-3 border-b border-border px-4 md:px-8 py-4 md:py-8 overflow-hidden",
        // No-banner: deep teal → card → soft lime accent. Matches the
        // CompetitionCard fallback so the card → detail transition reads
        // continuous.
        bannerUrl
          ? ""
          : "bg-gradient-to-br from-teal-950 via-card/80 to-primary/15",
        className,
      )}
      style={
        bannerUrl
          ? {
              // Round-47 — cover image stays at FULL fidelity in the
              // background. Legibility comes from a localised
              // backdrop-blur panel behind the text (see below) plus a
              // soft bottom-up fade — not a flat 70% dark wash that used
              // to mute every uploaded banner.
              backgroundImage: `url('${bannerUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {bannerUrl ? (
        <>
          {/* Bottom-up fade for the meta row contrast. Doesn't touch the
              top of the image so the cover stays visible. */}
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 via-black/30 to-transparent pointer-events-none"
          />
          {/* Soft top fade so the eyebrow chip + actions row don't fight
              busy areas of the cover. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent pointer-events-none"
          />
        </>
      ) : (
        <span
          aria-hidden
          className="absolute -top-16 -right-16 size-48 rounded-full bg-primary/15 blur-3xl pointer-events-none"
        />
      )}
      {eyebrow ? (
        <div
          className={cn(
            "relative flex items-center gap-2 text-xs font-semibold uppercase",
            bannerUrl ? "text-white/85" : "text-muted-foreground",
          )}
        >
          {eyebrow}
        </div>
      ) : null}
      <div className="relative flex items-start justify-between gap-6">
        <div className="space-y-2">
          {bannerUrl ? (
            // Round-47 — backdrop-blur "glass" panel sits ONLY behind the
            // headline + description so the title pops against any photo
            // without flattening the rest of the cover. Inline-block keeps
            // the panel hugging the text width on big titles.
            <div className="inline-block max-w-2xl rounded-xl bg-black/35 px-4 py-3 backdrop-blur-md ring-1 ring-white/10">
              <h1 className="text-2xl font-semibold text-primary drop-shadow md:text-3xl">
                {title}
              </h1>
              {description ? (
                <div className="mt-1 text-sm text-white/85">
                  {description}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-primary md:text-3xl">{title}</h1>
              {description ? (
                <div className="text-sm text-muted-foreground max-w-2xl">
                  {description}
                </div>
              ) : null}
            </>
          )}
        </div>
        {actions ? (
          <div
            className={cn(
              "flex items-center gap-2",
              bannerUrl &&
                "rounded-xl bg-black/30 px-2 py-1 backdrop-blur-md ring-1 ring-white/10",
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
      {meta ? (
        <div
          className={cn(
            "relative flex flex-wrap items-center gap-3 text-sm",
            bannerUrl ? "text-white/85" : "text-muted-foreground",
          )}
        >
          {meta}
        </div>
      ) : null}
    </section>
  );
}
