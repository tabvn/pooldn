"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CompetitionStatus,
  GameType,
} from "@/lib/generated/prisma/enums";

/**
 * Round-49 — redesigned filter bar for /competitions.
 *
 * - Search input with a debounced URL update and a clear (X) button.
 * - Status + game-type chips replace the dropdowns: one click toggles,
 *   visible active state, easier on the eyes than nested selects.
 * - Active-filter pills + Clear all sit underneath so the captain can
 *   see at a glance what they're filtering by and undo each one
 *   individually without reaching back into the bar.
 */

type ChipOption<V extends string> = { value: V; label: string };

const STATUS_CHIPS: ChipOption<CompetitionStatus | "">[] = [
  { value: "", label: "All" },
  { value: CompetitionStatus.OPEN_FOR_APPLICATIONS, label: "Open" },
  { value: CompetitionStatus.APPLICATIONS_CLOSED, label: "Closed" },
  { value: CompetitionStatus.ONGOING, label: "Ongoing" },
  { value: CompetitionStatus.COMPLETED, label: "Completed" },
];

const GAME_CHIPS: ChipOption<GameType | "">[] = [
  { value: "", label: "All games" },
  { value: GameType.EIGHT_BALL, label: "8-ball" },
  { value: GameType.NINE_BALL, label: "9-ball" },
  { value: GameType.TEN_BALL, label: "10-ball" },
  { value: GameType.STRAIGHT_POOL, label: "Straight" },
];

function labelFor<V extends string>(
  options: ChipOption<V | "">[],
  value: string,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

type Props = {
  /** Optional total-result count rendered next to the active-pills row. */
  resultCount?: number;
};

export function CompetitionsFilters({ resultCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const gameType = searchParams.get("gameType") ?? "";
  const urlSearch = searchParams.get("search") ?? "";

  // Local search state so typing is responsive — we push to the URL on a
  // 250ms debounce so we don't hammer SSR with every keystroke.
  const [search, setSearch] = useState(urlSearch);
  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (search === urlSearch) return;
      setParam("search", search);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("status");
    next.delete("gameType");
    next.delete("search");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    setSearch("");
  }

  const activePills: Array<{ key: string; label: string }> = [];
  if (search.trim()) activePills.push({ key: "search", label: `"${search.trim()}"` });
  if (status)
    activePills.push({ key: "status", label: labelFor(STATUS_CHIPS, status) });
  if (gameType)
    activePills.push({ key: "gameType", label: labelFor(GAME_CHIPS, gameType) });

  return (
    <section
      data-testid="competitions-filters"
      className="space-y-4 rounded-2xl border border-border bg-card p-4"
    >
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search competitions by name or slug…"
          className="block w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          data-testid="filter-search"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Status chips */}
      <ChipRow
        label="Status"
        value={status}
        onChange={(v) => setParam("status", v)}
        options={STATUS_CHIPS}
        testIdPrefix="filter-status"
      />

      {/* Game-type chips */}
      <ChipRow
        label="Game"
        value={gameType}
        onChange={(v) => setParam("gameType", v)}
        options={GAME_CHIPS}
        testIdPrefix="filter-game"
      />

      {/* Active pills + clear */}
      {activePills.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 border-t border-border pt-3"
          data-testid="active-filter-pills"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Active
          </span>
          {activePills.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                if (p.key === "search") setSearch("");
                else setParam(p.key, "");
              }}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
              data-testid={`active-pill-${p.key}`}
            >
              {p.label}
              <X className="size-3" />
            </button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            data-testid="clear-all-filters"
          >
            Clear all
          </Button>
          {typeof resultCount === "number" ? (
            <span className="ml-auto text-xs text-muted-foreground">
              {resultCount} result{resultCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ChipRow<V extends string>({
  label,
  value,
  onChange,
  options,
  testIdPrefix,
}: {
  label: string;
  value: string;
  onChange: (v: V | "") => void;
  options: ChipOption<V | "">[];
  testIdPrefix: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value || "__all__"}
            type="button"
            onClick={() => onChange(opt.value)}
            data-active={active || undefined}
            data-testid={`${testIdPrefix}-${opt.value || "all"}`}
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
