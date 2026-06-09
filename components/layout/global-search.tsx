"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLazyQuery } from "@apollo/client/react";
import type { ResultOf } from "@graphql-typed-document-node/core";
import { CornerDownLeft, Loader2, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GlobalSearchQuery } from "@/lib/graphql/operations/search.operations";
import { SearchSnippet } from "./search-snippet";
import {
  searchKindBadge,
  searchKindLabel,
  searchResultHref,
} from "./search-href";

type Hit = ResultOf<typeof GlobalSearchQuery>["search"][number];

const KIND_ORDER: ReadonlyArray<"COMPETITION" | "TEAM" | "PLAYER" | "VENUE" | "POST"> = [
  "COMPETITION",
  "TEAM",
  "PLAYER",
  "VENUE",
  "POST",
];
const RECENT_KEY = "pooldn.search.recent";
const RECENT_LIMIT = 6;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((s): s is string => typeof s === "string").slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function pushRecent(q: string): string[] {
  const cur = loadRecent().filter((s) => s !== q);
  const next = [q, ...cur].slice(0, RECENT_LIMIT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

/**
 * Round-34 — header search input + dropdown.
 *
 * Behavior:
 *   - Type to search, debounced ~200ms.
 *   - Cmd/Ctrl+K from anywhere opens the same panel.
 *   - Arrow keys move through hits; Enter activates the focused one;
 *     Esc closes.
 *   - Empty state shows recent queries (last 6, persisted in localStorage).
 *   - A "See all results for …" footer link goes to the full /search page.
 */
export function GlobalSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [kindFilter, setKindFilter] = useState<
    "ALL" | "COMPETITION" | "TEAM" | "PLAYER" | "VENUE" | "POST"
  >("ALL");
  const [run, { data, loading }] = useLazyQuery(GlobalSearchQuery);

  // Hydrate recent + watch cmd+k from anywhere.
  useEffect(() => {
    setRecent(loadRecent());
    function onKey(e: KeyboardEvent) {
      const isCmdK =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Debounced search.
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    const t = setTimeout(() => {
      void run({ variables: { q: trimmed, perKind: 5 } });
    }, 200);
    return () => clearTimeout(t);
  }, [q, run]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const rawHits = data?.search ?? [];
  const hits =
    kindFilter === "ALL" ? rawHits : rawHits.filter((r) => r.kind === kindFilter);
  const grouped = hits.reduce<Record<string, Hit[]>>((acc, r) => {
    acc[r.kind] = acc[r.kind] ?? [];
    acc[r.kind].push(r);
    return acc;
  }, {});
  const flatOrder: Hit[] = KIND_ORDER.flatMap((k) => grouped[k] ?? []);

  // Per-kind counts off the unfiltered set (so the chip badge shows the
  // total available, not just what's visible right now).
  const kindCounts = rawHits.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] ?? 0) + 1;
    return acc;
  }, {});

  // Reset active index whenever the result set changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [hits]);

  function commit(target: Hit) {
    setOpen(false);
    setQ("");
    setRecent(pushRecent(target.title));
    router.push(searchResultHref(target.kind, target.slug));
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(flatOrder.length - 1, 0)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = q.trim();
      if (flatOrder.length > 0 && flatOrder[activeIdx]) {
        commit(flatOrder[activeIdx]);
      } else if (trimmed.length >= 2) {
        // Fallback — open the full search page.
        setOpen(false);
        setRecent(pushRecent(trimmed));
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full sm:w-[420px] md:max-w-[520px]"
    >
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKey}
          placeholder="Search competitions, teams, players…"
          data-testid="global-search-input"
          className="w-full rounded-full border border-border bg-background pl-8 pr-12 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-autocomplete="list"
          aria-controls="global-search-listbox"
          aria-expanded={open}
        />
        <kbd
          className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-secondary/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
          aria-hidden
        >
          ⌘K
        </kbd>
      </div>
      {open ? (
        <div
          className="absolute left-0 right-0 top-full mt-2 z-50 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card shadow-xl"
          data-testid="global-search-results"
          id="global-search-listbox"
          role="listbox"
        >
          {/* Filter chips — visible while there's a real query in flight or
              we already have results. Skip on the empty/recent state. */}
          {q.trim().length >= 2 && rawHits.length > 0 ? (
            <div className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2">
              {(
                [
                  ["ALL", "All", rawHits.length],
                  ["COMPETITION", "Competitions", kindCounts.COMPETITION ?? 0],
                  ["TEAM", "Teams", kindCounts.TEAM ?? 0],
                  ["PLAYER", "Players", kindCounts.PLAYER ?? 0],
                  ["VENUE", "Venues", kindCounts.VENUE ?? 0],
                  ["POST", "Posts", kindCounts.POST ?? 0],
                ] as const
              )
                .filter(([k, , n]) => k === "ALL" || n > 0)
                .map(([k, label, n]) => {
                  const active = kindFilter === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKindFilter(k)}
                      data-testid={`global-search-chip-${k.toLowerCase()}`}
                      className={
                        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors " +
                        (active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground")
                      }
                    >
                      {label}
                      <span
                        className={
                          "rounded-full px-1.5 py-0.5 text-[10px] " +
                          (active
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-secondary text-muted-foreground")
                        }
                      >
                        {n}
                      </span>
                    </button>
                  );
                })}
            </div>
          ) : null}

          {q.trim().length < 2 ? (
            <RecentList
              recent={recent}
              onPick={(s) => {
                setQ(s);
              }}
            />
          ) : loading && hits.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" /> Searching…
            </p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              No results for "{q.trim()}".
            </p>
          ) : (
            <>
              {KIND_ORDER.map((kind) => {
                const rows = grouped[kind] ?? [];
                if (rows.length === 0) return null;
                return (
                  <div
                    key={kind}
                    className="border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {searchKindLabel(kind)}s
                    </div>
                    <ul>
                      {rows.map((r) => {
                        const idx = flatOrder.indexOf(r);
                        const active = idx === activeIdx;
                        return (
                          <li key={`${r.kind}-${r.id}`}>
                            <button
                              type="button"
                              onMouseEnter={() => setActiveIdx(idx)}
                              onClick={() => commit(r)}
                              role="option"
                              aria-selected={active}
                              data-testid={`global-search-${r.kind}-${r.id}`}
                              className={`flex w-full items-start gap-2 px-3 py-2 text-left ${
                                active ? "bg-secondary/60" : ""
                              }`}
                            >
                              <Avatar
                                size="sm"
                                src={r.imageUrl ?? undefined}
                                fallback={r.title}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-semibold">
                                    {r.title}
                                  </span>
                                  <Badge
                                    variant={searchKindBadge(r.kind)}
                                    size="sm"
                                  >
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
                              {active ? (
                                <CornerDownLeft className="mt-1 size-3 shrink-0 text-muted-foreground" />
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              <Link
                href={`/search?q=${encodeURIComponent(q.trim())}`}
                onClick={() => setOpen(false)}
                className="block border-t border-border px-3 py-2 text-xs font-semibold text-primary hover:bg-secondary/60"
              >
                See all results for "{q.trim()}" →
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function RecentList({
  recent,
  onPick,
}: {
  recent: string[];
  onPick: (q: string) => void;
}) {
  if (recent.length === 0) {
    return (
      <p className="px-3 py-3 text-xs text-muted-foreground">
        Start typing to search across competitions, teams, players, venues
        and community posts.
      </p>
    );
  }
  return (
    <div>
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        Recent
      </div>
      <ul>
        {recent.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-secondary/60"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
