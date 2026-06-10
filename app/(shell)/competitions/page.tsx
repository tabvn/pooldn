import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompetitionCard } from "@/components/competition/competition-card";
import { CompetitionsFilters } from "@/components/competition/competitions-filters";
import { getClient } from "@/lib/apollo/client";
import { getHeaderCityId } from "@/lib/headers/city";
import {
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

const STATUS_DOT: Record<string, string> = {
  DRAFT: "bg-warning",
  CANCELLED: "bg-destructive",
  OPEN_FOR_APPLICATIONS: "bg-primary",
  APPLICATIONS_CLOSED: "bg-warning",
  ONGOING: "bg-success",
  COMPLETED: "bg-success/60",
};

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
  const [{ data }, viewerResult, myCompsResult] = await Promise.all([
    client.query({ query: CompetitionsListQuery, variables: { filters } }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
    client.query({ query: MyCompetitionsQuery, errorPolicy: "ignore" }),
  ]);
  const competitions = data?.competitions ?? [];
  const viewer = viewerResult.data?.viewer;
  const myComps = myCompsResult.data?.myCompetitions ?? [];
  const canCreate = !!viewer;
  const hasActiveFilters =
    !!filters.status || !!filters.gameType || !!filters.search;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
      {/* Page header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Trophy className="size-3.5" />
            Poolhub
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Competitions
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Every public competition on PoolDN. Filter by what's open, what's
            running, or the game you play.
          </p>
        </div>
        {canCreate ? (
          <Link href="/competitions/new">
            <Button size="lg">
              <Plus className="size-4" />
              Create competition
            </Button>
          </Link>
        ) : null}
      </header>

      {/* Your competitions — compact strip; hidden when empty */}
      {myComps.length > 0 ? (
        <section
          className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4"
          data-testid="my-competitions"
        >
          <header className="mb-3 flex items-baseline justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary">
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
                    className={`inline-block size-2 rounded-full ${STATUS_DOT[c.status] ?? "bg-muted"}`}
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

      {/* Filters */}
      <CompetitionsFilters resultCount={competitions.length} />

      {/* Results */}
      {competitions.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
          data-testid="competitions-empty"
        >
          <div className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Trophy className="size-5" />
          </div>
          <h3 className="text-base font-semibold">
            {hasActiveFilters
              ? "No competitions match these filters"
              : "No competitions yet"}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Try clearing a filter — or check back once organizers post new ones."
              : canCreate
                ? "Be the first to spin up a competition for your city."
                : "Check back soon — organizers add new ones every week."}
          </p>
          {canCreate && !hasActiveFilters ? (
            <Link href="/competitions/new" className="mt-4 inline-block">
              <Button>
                <Plus className="size-4" />
                Create one
              </Button>
            </Link>
          ) : null}
        </div>
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
