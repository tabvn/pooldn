"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Content-scoped search box. Each list (players, teams, venues, …) renders
 * one above its results and filters its own content — there is no global
 * search.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  testId,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm outline-none transition-colors focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
