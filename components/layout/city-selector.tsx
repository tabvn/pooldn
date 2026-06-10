"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { ChevronDown, MapPin } from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui-components/react/popover";
import { CitiesQuery } from "@/lib/graphql/operations/competition.operations";

const COOKIE_NAME = "pooldn_city";

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

function writeCookie(cityId: string) {
  if (typeof document === "undefined") return;
  const isSecure = window.location.protocol === "https:";
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = [
    `${COOKIE_NAME}=${cityId}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${oneYear}`,
    isSecure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Round-45 — functional city switcher.
 *
 * The selected city id is persisted in a `pooldn_city` cookie so SSR can
 * read it on the next request. Selecting a different city writes the cookie
 * and refreshes the route — RSC trees re-render scoped to the new city.
 *
 * The default label "Da Nang, Vietnam" stays for guests who haven't picked
 * yet; the dropdown is hydrated from the active-only `cities` query so
 * admin-deactivated cities never appear.
 */
export function CitySelector({ city: initialLabel }: { city: string }) {
  const router = useRouter();
  const [label, setLabel] = useState(initialLabel);
  const { data } = useQuery(CitiesQuery, { errorPolicy: "ignore" });
  const cities = data?.cities ?? [];
  // R45+ — when only one active city exists, there's nothing to switch.
  // We collapse to a non-interactive label (no chevron, no popover, no
  // "All cities" option). The cookie keeps whatever value the user had so
  // the next time another city gets added everything stays consistent.
  const singleCity = cities.length === 1;

  // Keep the visible label in sync with the cookie if the user changes it
  // via a different tab. (Reading document.cookie isn't reactive; useEffect
  // refreshes on mount which is enough for our needs.)
  useEffect(() => {
    setLabel(initialLabel);
  }, [initialLabel]);

  function onPick(cityId: string, cityLabel: string) {
    writeCookie(cityId);
    setLabel(cityLabel);
    router.refresh();
  }

  if (singleCity) {
    const only = cities[0]!;
    const onlyLabel = `${only.name}, ${only.country.name}`;
    return (
      <div
        className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-sm font-semibold"
        data-testid="city-selector-static"
        aria-label={`Location: ${onlyLabel}`}
      >
        <span className="text-base leading-none" aria-hidden>
          {flagFor(onlyLabel)}
        </span>
        <span className="hidden sm:inline">{onlyLabel}</span>
      </div>
    );
  }

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-sm font-semibold hover:bg-secondary"
        aria-label="Change city"
        data-testid="city-selector"
      >
        <span className="text-base leading-none" aria-hidden>
          {flagFor(label)}
        </span>
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        {/* Header is sticky at z-30; popups need z-40+ to sit above it. */}
        <PopoverPrimitive.Positioner sideOffset={6} align="start" className="z-50">
          <PopoverPrimitive.Popup
            className="z-50 w-[260px] max-h-[60vh] overflow-auto rounded-xl border border-border bg-card text-card-foreground shadow-xl outline-none"
            data-testid="city-popover"
          >
            <div className="border-b border-border px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
              Switch city
            </div>
            <ul className="py-1">
              <li>
                <button
                  type="button"
                  onClick={() => onPick("all", "All cities")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/60"
                  data-testid="city-option-all"
                >
                  <MapPin className="size-3.5 text-muted-foreground" />
                  All cities
                </button>
              </li>
              {cities.map((c) => {
                const itemLabel = `${c.name}, ${c.country.name}`;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onPick(c.id, itemLabel)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/60"
                      data-testid={`city-option-${c.id}`}
                    >
                      <span className="text-base leading-none" aria-hidden>
                        {flagFor(itemLabel)}
                      </span>
                      <span className="flex-1 text-left">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.country.code}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
