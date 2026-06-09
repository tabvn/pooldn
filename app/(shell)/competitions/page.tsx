import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CompetitionCard } from "@/components/competition/competition-card";
import { PoolhubFilters } from "@/components/competition/poolhub-filters";
import { getClient } from "@/lib/apollo/client";
import { getHeaderCityId } from "@/lib/headers/city";
import {
  CitiesQuery,
  CompetitionsListQuery,
  MyCompetitionsQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";
import type {
  CompetitionStatus,
  GameType,
} from "@/lib/generated/prisma/enums";

const STATUS_VALUES: ReadonlySet<CompetitionStatus> = new Set([
  "DRAFT",
  "OPEN_FOR_APPLICATIONS",
  "APPLICATIONS_CLOSED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);
const GAME_VALUES: ReadonlySet<GameType> = new Set([
  "EIGHT_BALL",
  "NINE_BALL",
  "TEN_BALL",
  "STRAIGHT_POOL",
]);

export default async function CompetitionsBrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusRaw = typeof sp.status === "string" ? sp.status : "";
  const gameRaw = typeof sp.gameType === "string" ? sp.gameType : "";
  // R45 — explicit ?cityId in the URL still wins. Otherwise the header
  // city scope applies.
  const urlCityId = typeof sp.cityId === "string" ? sp.cityId : "";
  const headerCityId = await getHeaderCityId();
  const cityId = urlCityId || headerCityId || "";
  const search = typeof sp.search === "string" ? sp.search : "";

  const filters = {
    status: STATUS_VALUES.has(statusRaw as CompetitionStatus)
      ? (statusRaw as CompetitionStatus)
      : undefined,
    gameType: GAME_VALUES.has(gameRaw as GameType)
      ? (gameRaw as GameType)
      : undefined,
    cityId: cityId || undefined,
    search: search || undefined,
  };

  const client = getClient();
  const [{ data }, viewerResult, citiesResult, myCompsResult] =
    await Promise.all([
      client.query({ query: CompetitionsListQuery, variables: { filters } }),
      client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
      client.query({ query: CitiesQuery, errorPolicy: "ignore" }),
      client.query({ query: MyCompetitionsQuery, errorPolicy: "ignore" }),
    ]);
  const competitions = data?.competitions ?? [];
  const viewer = viewerResult.data?.viewer;
  const cities = citiesResult.data?.cities ?? [];
  const myComps = myCompsResult.data?.myCompetitions ?? [];
  const canCreate = !!viewer;

  return (
    <div className="p-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">Browse competitions</h1>
          <p className="text-sm text-muted-foreground">
            Every public competition, filterable by status, game type, and city.
          </p>
        </div>
        {canCreate ? (
          <Link href="/competitions/new">
            <Button>Create competition</Button>
          </Link>
        ) : null}
      </header>

      {myComps.length > 0 ? (
        <section
          className="rounded-xl border border-primary/30 bg-primary/5 p-4"
          data-testid="my-competitions"
        >
          <header className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              Your competitions
            </h3>
            <span className="text-xs text-muted-foreground">
              {myComps.length} total
            </span>
          </header>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {myComps.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/competitions/${c.slug}`}
                  className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40"
                  data-testid={`my-competition-${c.id}`}
                >
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{
                      backgroundColor:
                        c.status === "DRAFT"
                          ? "rgb(245 158 11)"
                          : c.status === "CANCELLED"
                            ? "rgb(239 68 68)"
                            : "rgb(34 197 94)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {c.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.status.replace(/_/g, " ").toLowerCase()}
                      {c.city ? ` · ${c.city.name}` : ""}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PoolhubFilters cities={cities} />

      {competitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No competitions match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {competitions.map((c) => (
            <CompetitionCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
