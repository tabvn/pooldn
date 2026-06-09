"use client";

import { useMemo } from "react";
import { Select } from "@/components/ui/select";
import { CountryFlag } from "@/components/ui/country-flag";

/**
 * Compact ISO-3166 alpha-2 list (top markets + a sensible long tail). Keeps
 * the bundle tiny — when we localise we'll swap to `Intl.DisplayNames`.
 */
const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "VN", name: "Vietnam" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "TW", name: "Taiwan" },
  { code: "HK", name: "Hong Kong" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "TH", name: "Thailand" },
  { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "TR", name: "Türkiye" },
  { code: "IL", name: "Israel" },
  { code: "EG", name: "Egypt" },
  { code: "MA", name: "Morocco" },
  { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "Mexico" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "BE", name: "Belgium" },
  { code: "AT", name: "Austria" },
  { code: "CH", name: "Switzerland" },
  { code: "PT", name: "Portugal" },
  { code: "GR", name: "Greece" },
  { code: "CZ", name: "Czechia" },
  { code: "HU", name: "Hungary" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" },
];

export function CountrySelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const options = useMemo(
    () => [
      {
        value: "",
        label: <span className="text-muted-foreground">— none —</span>,
      },
      ...COUNTRIES.map((c) => ({
        value: c.code,
        label: (
          <span className="inline-flex items-center gap-2">
            <CountryFlag code={c.code} className="text-base leading-none" />
            <span>{c.name}</span>
            <span className="text-xs text-muted-foreground">({c.code})</span>
          </span>
        ),
      })),
    ],
    [],
  );
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      placeholder="— none —"
      options={options}
    />
  );
}
