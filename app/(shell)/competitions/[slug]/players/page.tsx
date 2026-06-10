import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/ui/country-flag";
import { getClient } from "@/lib/apollo/client";
import { CompetitionPlayersQuery } from "@/lib/graphql/operations/competition.operations";

export default async function PlayersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await getClient().query({
    query: CompetitionPlayersQuery,
    variables: { slug },
  });
  const c = data?.competition;
  if (!c) return null;

  // Round-50 — Players tab now lists every locked roster slot (one card per
  // approved-team player), with PlayerCompStat merged when available. Sort:
  // MVP-flagged players first, then by mvpScore desc, then framesWon desc,
  // then alphabetical so unplayed rosters get a stable order.
  const rosters = [...c.rosters].sort((a, b) => {
    const am = a.stat?.isMvp ? 1 : 0;
    const bm = b.stat?.isMvp ? 1 : 0;
    if (am !== bm) return bm - am;
    const as = a.stat?.mvpScore ?? -1;
    const bs = b.stat?.mvpScore ?? -1;
    if (as !== bs) return bs - as;
    const af = a.stat?.framesWon ?? -1;
    const bf = b.stat?.framesWon ?? -1;
    if (af !== bf) return bf - af;
    return a.user.name.localeCompare(b.user.name);
  });

  if (rosters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No players locked in yet — approved teams will appear here once their
        rosters are set.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rosters.map((r) => {
        const s = r.stat;
        const pct =
          s && s.framesPlayed > 0
            ? Math.round((s.framesWon / s.framesPlayed) * 100)
            : null;
        return (
          <div
            key={r.id}
            data-testid={`competition-roster-${r.user.id}`}
            className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-start gap-3">
              <Link
                href={`/players/${r.user.username}`}
                className="shrink-0"
              >
                <Avatar
                  size="lg"
                  src={r.user.avatarUrl ?? undefined}
                  fallback={r.user.name}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/players/${r.user.username}`}
                    className="truncate font-semibold hover:underline"
                  >
                    {r.user.name}
                  </Link>
                  {r.user.nationality ? (
                    <CountryFlag
                      code={r.user.nationality}
                      className="text-base leading-none"
                    />
                  ) : null}
                  {s?.isMvp ? (
                    <Badge variant="primary" size="sm">
                      MVP
                    </Badge>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  @{r.user.username}
                </div>
                <Link
                  href={`/teams/${r.team.slug}`}
                  className="mt-2 flex items-center gap-2 text-sm hover:underline"
                >
                  <Avatar
                    size="sm"
                    src={r.team.logoUrl ?? undefined}
                    fallback={r.team.name}
                    shape="team"
                  />
                  <span className="truncate">{r.team.name}</span>
                </Link>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
              <Stat
                label="Score"
                value={s ? String(s.mvpScore) : "—"}
                emphasize={!!s?.isMvp}
              />
              <Stat
                label="Matches"
                value={s ? String(s.matchesPlayed) : "—"}
              />
              <Stat label="Win %" value={pct === null ? "—" : `${pct}%`} />
            </dl>
            {s && (s.singlesWon > 0 || s.doublesWon > 0 || s.brWon > 0) ? (
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                {s.singlesWon > 0 ? (
                  <span className="rounded-full bg-secondary/40 px-2 py-0.5">
                    S: {s.singlesWon}
                  </span>
                ) : null}
                {s.doublesWon > 0 ? (
                  <span className="rounded-full bg-secondary/40 px-2 py-0.5">
                    D: {s.doublesWon}
                  </span>
                ) : null}
                {s.brWon > 0 ? (
                  <span className="rounded-full bg-secondary/40 px-2 py-0.5">
                    B&amp;R: {s.brWon}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          "mt-0.5 font-mono tabular-nums font-bold " +
          (emphasize ? "text-primary" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}
