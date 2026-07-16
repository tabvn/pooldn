"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { CountryFlag } from "@/components/ui/country-flag";
import { SearchInput } from "@/components/ui/search-input";
import { CityPlayersQuery } from "@/lib/graphql/operations/community.operations";

export function CommunityPlayers({
  cityId,
  cityName,
}: {
  /** SSR-resolved from the header city cookie. The header's CitySelector is
   *  the only city control — the directory reflects that scope. */
  cityId: string | null;
  /** Display name of the active city, or null when unscoped (all cities). */
  cityName: string | null;
}) {
  const [q, setQ] = useState("");

  const players = useQuery(CityPlayersQuery, {
    variables: { cityId: cityId ?? undefined, first: 100 },
    fetchPolicy: "cache-and-network",
  });

  const needle = q.trim().toLowerCase();
  const list = (players.data?.users ?? []).filter(
    (u) =>
      !needle ||
      u.name.toLowerCase().includes(needle) ||
      u.username.toLowerCase().includes(needle),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold md:text-3xl">
          {cityName ? `${cityName} Pool Community` : "Community"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {cityName ? `Players in ${cityName}.` : "Players in your city."}
        </p>
      </header>

      <div className="space-y-3" data-testid="community-players">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search players…"
          testId="players-search"
        />
        {players.loading && !players.data ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading players…
          </p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {q
              ? "No players match your search."
              : "No players in this city yet."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {list.map((u) => (
              <Link
                key={u.id}
                href={`/players/${u.username}`}
                data-testid={`community-player-${u.username}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
              >
                <Avatar
                  size="md"
                  src={u.avatarUrl ?? undefined}
                  fallback={u.name}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{u.name}</span>
                    <CountryFlag code={u.nationality} className="leading-none" />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    @{u.username}
                    {u.city?.name ? ` · ${u.city.name}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
