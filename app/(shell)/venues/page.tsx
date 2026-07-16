import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getClient } from "@/lib/apollo/client";
import { VenuesListQuery } from "@/lib/graphql/operations/venue.operations";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import { getHeaderCityId, getHeaderCityName } from "@/lib/headers/city";
import { VenuesBrowse } from "./browse";

export default async function VenuesPage() {
  const client = getClient();
  const [cityId, cityName] = await Promise.all([
    getHeaderCityId(),
    getHeaderCityName(),
  ]);
  const [{ data }, viewerResult] = await Promise.all([
    client.query({
      query: VenuesListQuery,
      variables: { cityId: cityId ?? undefined },
    }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
  ]);
  const venues = data?.venues ?? [];
  const viewer = viewerResult.data?.viewer;
  const canCreate =
    viewer?.role === "ORGANIZER" || viewer?.role === "SUPER_ADMIN";

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold md:text-3xl">
            {cityName ? `Venues in ${cityName}` : "Venues"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Places where matches happen.
          </p>
        </div>
        {canCreate ? (
          <Link href="/venues/new">
            <Button>Add venue</Button>
          </Link>
        ) : null}
      </header>

      <VenuesBrowse venues={venues} />
    </div>
  );
}
