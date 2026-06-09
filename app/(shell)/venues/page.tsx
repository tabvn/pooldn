import Link from "next/link";
// eslint-disable-next-line @next/next/no-img-element
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getClient } from "@/lib/apollo/client";
import { VenuesListQuery } from "@/lib/graphql/operations/venue.operations";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import { getHeaderCityId } from "@/lib/headers/city";

export default async function VenuesPage() {
  const client = getClient();
  const cityId = await getHeaderCityId();
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
    <div className="p-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">Venues</h1>
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

      {venues.length === 0 ? (
        <p className="text-sm text-muted-foreground">No venues yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {venues.map((v) => (
            <Link key={v.id} href={`/venues/${v.slug}`}>
              <Card className="overflow-hidden hover:border-primary/50 transition-colors">
                {v.imageUrl ? (
                  <div className="h-32 w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.imageUrl}
                      alt={v.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}
                <CardHeader>
                  <CardTitle>{v.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="text-muted-foreground">{v.address}</div>
                  <div className="text-muted-foreground">{v.city.name}</div>
                  {v.tableCount ? (
                    <Badge variant="primary" size="sm">
                      {v.tableCount} tables
                    </Badge>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
