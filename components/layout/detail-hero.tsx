import type { ReactNode } from "react";

/**
 * Shared detail-screen hero — the lime-tinted full-bleed band used across
 * the app's entity pages (competitions, teams, venues). Mirrors
 * CompetitionHero: the band bleeds full-width while its content aligns to
 * the same max-w-5xl shell as the tabs + content below, so every detail
 * screen lines up on one grid.
 *
 * - `media`   optional leading element (e.g. a team logo avatar)
 * - `title`   the entity name, rendered in lime
 * - `meta`    a wrap-friendly row of badges / facts under the title
 * - `actions` rendered flush-right (Follow, Edit, action menu, …)
 */
export function DetailHero({
  media,
  title,
  meta,
  actions,
}: {
  media?: ReactNode;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="bg-primary/10">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-start justify-between gap-4 px-6 py-8 md:px-10 md:py-10">
        <div className="flex min-w-0 items-start gap-4">
          {media ? <div className="shrink-0">{media}</div> : null}
          <div className="min-w-0 space-y-3">
            <h1 className="text-2xl font-semibold text-primary md:text-3xl">
              {title}
            </h1>
            {meta ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                {meta}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
