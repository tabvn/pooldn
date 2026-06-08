"use client";

import { ChevronDown } from "lucide-react";

const FLAG_BY_COUNTRY: Record<string, string> = {
  Vietnam: "🇻🇳",
  Canada: "🇨🇦",
  Australia: "🇦🇺",
  Philippines: "🇵🇭",
};

function flagFor(label: string): string {
  for (const [country, flag] of Object.entries(FLAG_BY_COUNTRY)) {
    if (label.includes(country)) return flag;
  }
  return "🌐";
}

export function CitySelector({ city }: { city: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-sm font-semibold hover:bg-secondary"
      aria-label="Change city"
    >
      <span className="text-base leading-none" aria-hidden>
        {flagFor(city)}
      </span>
      <span>{city}</span>
      <ChevronDown className="size-4 text-muted-foreground" />
    </button>
  );
}
