import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CompetitionCard } from "@/components/competition/competition-card";
import { PoolhubFilters } from "@/components/competition/poolhub-filters";
import { getClient } from "@/lib/apollo/client";
import {
  CitiesQuery,
  CompetitionsListQuery,
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
  const cityId = typeof sp.cityId === "string" ? sp.cityId : "";
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
  const [{ data }, viewerResult, citiesResult] = await Promise.all([
    client.query({ query: CompetitionsListQuery, variables: { filters } }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
    client.query({ query: CitiesQuery, errorPolicy: "ignore" }),
  ]);
  const competitions = data?.competitions ?? [];
  const viewer = viewerResult.data?.viewer;
  const cities = citiesResult.data?.cities ?? [];
  const canCreate =
    viewer?.role === "ORGANIZER" || viewer?.role === "SUPER_ADMIN";

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
