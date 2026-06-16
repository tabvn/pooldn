"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import {
  CompetitionStatus,
  GameType,
} from "@/lib/generated/prisma/enums";

/**
 * Filter bar for /competitions — a content-scoped search box (by name) plus
 * status + game bucket chips. There is no global search; each list filters
 * its own content.
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
  /** Result count rendered on the right side of the toolbar. */
  resultCount?: number;
};

export function CompetitionsFilters({ resultCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const gameType = searchParams.get("gameType") ?? "";
  // Local mirror so typing stays smooth while each change also updates the
  // URL (the server page re-queries on ?search=).
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

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
  }

  const activePills: Array<{ key: string; label: string }> = [];
  if (status)
    activePills.push({ key: "status", label: labelFor(STATUS_CHIPS, status) });
  if (gameType)
    activePills.push({ key: "gameType", label: labelFor(GAME_CHIPS, gameType) });

  return (
    <section
      data-testid="competitions-filters"
      className="space-y-3 border-b border-border pb-4"
    >
      <SearchInput
        value={search}
        onChange={(v) => {
          setSearch(v);
          setParam("search", v);
        }}
        placeholder="Search competitions…"
        testId="competitions-search"
        className="max-w-md"
      />

      {/* Chip rows + result count */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <ChipRow
          label="Status"
          value={status}
          onChange={(v) => setParam("status", v)}
          options={STATUS_CHIPS}
          testIdPrefix="filter-status"
        />
        <span className="hidden h-5 w-px bg-border md:block" />
        <ChipRow
          label="Game"
          value={gameType}
          onChange={(v) => setParam("gameType", v)}
          options={GAME_CHIPS}
          testIdPrefix="filter-game"
        />
        {typeof resultCount === "number" ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {resultCount} result{resultCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {/* Active pills + clear */}
      {activePills.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid="active-filter-pills"
        >
          {activePills.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setParam(p.key, "")}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
              data-testid={`active-pill-${p.key}`}
            >
              {p.label}
              <X className="size-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            data-testid="clear-all-filters"
          >
            Clear all
          </button>
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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
