"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import {
  RankingsQuery,
  RankingsTeamFilterQuery,
} from "@/lib/graphql/operations/rankings.operations";

const PAGE = 50;

type TeamRef = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
};

/**
 * Round-49 — redesigned rankings page.
 *
 * - Team filter (search-as-you-type combobox of the visible teams).
 * - Each row surfaces the player's team affiliations as small avatars,
 *   capped at 3 + "+N" for the rest (server returns `teams(limit:3)` and
 *   `teamsCount`).
 * - Load more stays as an explicit button (more predictable than infinite
 *   scroll for a leaderboard), but the loading state and result count
 *   sit in one spot at the bottom of the list.
 */
export function RankingsBoard() {
  const [teamFilter, setTeamFilter] = useState<TeamRef | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);

  const { data, loading, error, fetchMore, refetch } = useQuery(RankingsQuery, {
    variables: { first: PAGE, teamId: teamFilter?.id ?? null },
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  // Reset the "no more rows" flag whenever the filter changes — the
  // refetch'd list might be longer than the previous filter's tail.
  useEffect(() => {
    setDone(false);
  }, [teamFilter?.id]);

  const pages = data?.rankings ?? [];

  async function loadMore() {
    const last = pages[pages.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const r = await fetchMore({
        variables: { after: last.id, teamId: teamFilter?.id ?? null },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.rankings) return prev;
          return {
            ...prev,
            rankings: [...prev.rankings, ...fetchMoreResult.rankings],
          };
        },
      });
      const next = r.data?.rankings ?? [];
      if (next.length < PAGE) setDone(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-4">
      <TeamFilter
        selected={teamFilter}
        onSelect={(t) => {
          setTeamFilter(t);
          // Force a fresh first page when switching filters.
          if (t?.id !== teamFilter?.id) {
            void refetch({ first: PAGE, teamId: t?.id ?? null });
          }
        }}
      />

      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            Could not load rankings: {error.message}
          </CardContent>
        </Card>
      ) : loading && !data ? (
        <p className="text-sm text-muted-foreground">Loading rankings…</p>
      ) : pages.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {teamFilter
              ? `No ranked players found for ${teamFilter.name}.`
              : "No ranked players yet. Win some frames!"}
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-1.5" data-testid="rankings-board">
          {pages.map((u, i) => (
            <li key={u.id}>
              <Link
                href={`/players/${u.username}`}
                className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 transition-colors hover:border-primary/40 hover:bg-secondary/30"
                data-testid={`ranking-row-${i + 1}`}
              >
                <RankBadge rank={i + 1} />
                <Avatar
                  size="md"
                  src={u.avatarUrl ?? undefined}
                  fallback={u.name}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    {u.name}
                    {u.nationality ? (
                      <CountryFlag
                        code={u.nationality}
                        className="text-sm leading-none"
                      />
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">
                      @{u.username}
                      {u.city ? ` · ${u.city.name}` : ""}
                    </span>
                    <TeamAvatars teams={u.teams} total={u.teamsCount} />
                  </div>
                </div>
                {/* Round-50 — dropped the duplicate RatingBadge; the
                    number alone is cleaner and the rank chip on the left
                    already carries the tier signal for the podium. */}
                <span
                  className="font-mono text-base font-bold tabular-nums text-foreground"
                  data-testid={`ranking-rating-${i + 1}`}
                >
                  {u.rating}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {/* Load more / footer */}
      {pages.length > 0 ? (
        <div className="flex items-center justify-center gap-3 pt-2 text-xs text-muted-foreground">
          {!done && pages.length >= PAGE ? (
            <Button
              variant="outline"
              loading={loadingMore}
              onClick={loadMore}
              data-testid="rankings-load-more"
            >
              Load more
            </Button>
          ) : (
            <span>You've reached the end of the list.</span>
          )}
          <span>·</span>
          <span>
            Showing {pages.length} player{pages.length === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  // Podium accent for top 3; everyone else gets a plain numeric chip so the
  // list stays scannable as you scroll past 100.
  if (rank === 1) {
    return (
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-sm font-black text-warning ring-1 ring-warning/40">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground ring-1 ring-border">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-700/15 text-sm font-bold text-amber-600 ring-1 ring-amber-700/40">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex size-8 shrink-0 items-center justify-center font-mono text-sm font-bold text-muted-foreground">
      {rank}
    </span>
  );
}

function TeamAvatars({
  teams,
  total,
}: {
  teams: ReadonlyArray<TeamRef>;
  total: number;
}) {
  if (!teams.length) return null;
  const more = Math.max(0, total - teams.length);
  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1.5">
        {teams.map((t) => (
          <Avatar
            key={t.id}
            size="xs"
            src={t.logoUrl ?? undefined}
            fallback={t.name}
            shape="team"
            className="ring-1 ring-background"
          />
        ))}
      </div>
      {more > 0 ? (
        <span
          className="inline-flex items-center rounded-full border border-border bg-secondary/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
          aria-label={`Plus ${more} more team${more === 1 ? "" : "s"}`}
        >
          +{more}
        </span>
      ) : null}
    </div>
  );
}

function TeamFilter({
  selected,
  onSelect,
}: {
  selected: TeamRef | null;
  onSelect: (t: TeamRef | null) => void;
}) {
  const { data } = useQuery(RankingsTeamFilterQuery, {
    fetchPolicy: "cache-first",
    errorPolicy: "ignore",
  });
  const teams = useMemo(() => data?.teams ?? [], [data]);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close the dropdown when clicking outside; ignores clicks on the input.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams.slice(0, 8);
    return teams
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [teams, query]);

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      data-testid="rankings-team-filter"
    >
      <div className="relative w-full max-w-sm" ref={containerRef}>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={selected ? selected.name : query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected) onSelect(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Filter by team…"
          readOnly={!!selected}
          className={cn(
            "block w-full rounded-md border bg-background py-2 pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground",
            selected
              ? "cursor-pointer border-primary/40 text-primary"
              : "border-border focus:border-primary",
          )}
          data-testid="rankings-team-input"
        />
        {selected ? (
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery("");
              setOpen(false);
            }}
            aria-label="Clear team filter"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}

        {open && !selected ? (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                No teams match.
              </li>
            ) : (
              filtered.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(t);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary"
                    data-testid={`rankings-team-option-${t.slug}`}
                  >
                    <Avatar
                      size="xs"
                      src={t.logoUrl ?? undefined}
                      fallback={t.name}
                      shape="team"
                    />
                    <span className="truncate">{t.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {selected ? (
        <span className="text-xs text-muted-foreground">
          Showing players on <strong>{selected.name}</strong>.
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          Showing the global top.
        </span>
      )}
    </div>
  );
}
