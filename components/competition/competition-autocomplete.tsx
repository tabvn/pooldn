"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { competitionStatusLabel } from "@/components/ui/status-chip";
import { CompetitionsListQuery } from "@/lib/graphql/operations/competition.operations";

/**
 * Reusable competition typeahead — searches by name via the existing
 * `competitions(filters: { search })` query. Returns the selected id via
 * `onChange`. Used by /admin/score-submissions as the queue filter.
 */
export function CompetitionAutocomplete({
  value,
  onChange,
  placeholder = "All competitions",
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  // The list query supports a `search` filter. We send the user's text once
  // it's ≥2 chars; otherwise we leave it empty so the menu still has
  // "recent competitions" to pick from.
  const { data, loading } = useQuery(CompetitionsListQuery, {
    variables: {
      filters: { search: q.trim().length >= 2 ? q.trim() : undefined },
    },
    fetchPolicy: "cache-and-network",
  });
  const list = data?.competitions ?? [];

  // Resolve the currently-selected competition's label without re-querying
  // (the list already contains it most of the time).
  const selected = useMemo(() => list.find((c) => c.id === value), [list, value]);
  const [resolvedLabel, setResolvedLabel] = useState<string>("");
  useEffect(() => {
    if (selected) setResolvedLabel(selected.name);
  }, [selected]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(id: string, name: string) {
    onChange(id);
    setResolvedLabel(name);
    setOpen(false);
    setQ("");
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        data-testid="competition-autocomplete-trigger"
        className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm"
      >
        <span className="flex-1 truncate">
          {value ? (resolvedLabel || "…") : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        {value ? (
          <span
            role="button"
            aria-label="Clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setResolvedLabel("");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </span>
        ) : null}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open ? (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 max-h-72 overflow-y-auto rounded-md border border-border bg-card shadow-xl"
          data-testid="competition-autocomplete-menu"
        >
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card px-2 py-1.5">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to filter…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          {loading && list.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">Loading…</p>
          ) : list.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              No competitions match.
            </p>
          ) : (
            <ul>
              {list.slice(0, 20).map((c) => {
                const active = c.id === value;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pick(c.id, c.name)}
                      data-testid={`competition-autocomplete-option-${c.id}`}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/60",
                        active && "bg-secondary/40",
                      )}
                    >
                      <Avatar
                        size="sm"
                        src={c.bannerUrl ?? undefined}
                        fallback={c.name}
                        shape="competition"
                      />
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {competitionStatusLabel[c.status] ??
                          c.status.replace(/_/g, " ").toLowerCase()}
                      </span>
                      {active ? (
                        <Check className="size-3.5 text-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
