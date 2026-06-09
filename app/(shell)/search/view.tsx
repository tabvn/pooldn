"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { Loader2, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GlobalSearchQuery } from "@/lib/graphql/operations/search.operations";
import { SearchSnippet } from "@/components/layout/search-snippet";
import {
  searchKindBadge,
  searchKindLabel,
  searchResultHref,
} from "@/components/layout/search-href";

type Kind = "COMPETITION" | "TEAM" | "PLAYER" | "VENUE" | "POST";

const TABS: Array<{ key: Kind | "ALL"; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "COMPETITION", label: "Competitions" },
  { key: "TEAM", label: "Teams" },
  { key: "PLAYER", label: "Players" },
  { key: "VENUE", label: "Venues" },
  { key: "POST", label: "Posts" },
];

export function SearchResults({
  initialQ,
  initialKind,
}: {
  initialQ: string;
  initialKind: Kind | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [debounced, setDebounced] = useState(initialQ);
  const activeTab = (searchParams.get("kind") as Kind | null) ?? initialKind ?? "ALL";

  // Debounce query → URL push so it's shareable.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q.trim());
      const sp = new URLSearchParams(searchParams.toString());
      if (q.trim()) sp.set("q", q.trim());
      else sp.delete("q");
      const qs = sp.toString();
      router.replace(`/search${qs ? `?${qs}` : ""}`);
    }, 250);
    return () => clearTimeout(t);
  }, [q, router, searchParams]);

  function switchKind(k: Kind | "ALL") {
    const sp = new URLSearchParams(searchParams.toString());
    if (k === "ALL") sp.delete("kind");
    else sp.set("kind", k);
    const qs = sp.toString();
    router.replace(`/search${qs ? `?${qs}` : ""}`);
  }

  const kinds = activeTab === "ALL" ? undefined : ([activeTab] as Kind[]);
  const { data, loading } = useQuery(GlobalSearchQuery, {
    skip: debounced.length < 2,
    variables: { q: debounced, perKind: 20, kinds },
    fetchPolicy: "cache-and-network",
  });
  const hits = data?.search ?? [];
  const grouped = hits.reduce<Record<string, typeof hits>>((acc, r) => {
    acc[r.kind] = acc[r.kind] ?? [];
    acc[r.kind].push(r);
    return acc;
  }, {});
  const KIND_ORDER: Kind[] = [
    "COMPETITION",
    "TEAM",
    "PLAYER",
    "VENUE",
    "POST",
  ];

  return (
    <div className="space-y-5">
      {/* Query input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search competitions, teams, players, venues, posts…"
          className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          data-testid="search-page-input"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          const count =
            t.key === "ALL" ? hits.length : grouped[t.key as Kind]?.length ?? 0;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => switchKind(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
              }`}
              data-testid={`search-tab-${t.key}`}
            >
              {t.label}
              <span
                className={`tabular-nums ${
                  isActive ? "text-primary-foreground/80" : "text-muted-foreground/70"
                }`}
              >
                {debounced.length >= 2 ? count : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results */}
      {debounced.length < 2 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search.
          </CardContent>
        </Card>
      ) : loading && hits.length === 0 ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Searching…
        </p>
      ) : hits.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing matched "{debounced}".
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {KIND_ORDER.filter((k) => (grouped[k] ?? []).length > 0).map(
            (kind) => (
              <section key={kind} className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {searchKindLabel(kind)}s · {(grouped[kind] ?? []).length}
                </h2>
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {(grouped[kind] ?? []).map((r) => (
                    <li key={`${r.kind}-${r.id}`}>
                      <Link
                        href={searchResultHref(r.kind, r.slug)}
                        className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40"
                        data-testid={`search-result-${r.kind}-${r.id}`}
                      >
                        <Avatar
                          size="md"
                          src={r.imageUrl ?? undefined}
                          fallback={r.title}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                              {r.title}
                            </span>
                            <Badge variant={searchKindBadge(r.kind)} size="sm">
                              {searchKindLabel(r.kind)}
                            </Badge>
                          </div>
                          {r.subtitle ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {r.subtitle}
                            </div>
                          ) : null}
                          <SearchSnippet snippet={r.snippet ?? null} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}
