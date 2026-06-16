"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";

type Venue = {
  id: string;
  slug: string;
  name: string;
  address: string;
  imageUrl?: string | null;
  tableCount?: number | null;
  city: { name: string };
};

export function VenuesBrowse({ venues }: { venues: Venue[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return venues;
    return venues.filter(
      (v) =>
        v.name.toLowerCase().includes(needle) ||
        v.address.toLowerCase().includes(needle) ||
        v.city.name.toLowerCase().includes(needle),
    );
  }, [venues, q]);

  if (venues.length === 0) {
    return <p className="text-sm text-muted-foreground">No venues yet.</p>;
  }

  return (
    <div className="space-y-4" data-testid="venues-browse">
      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Search venues…"
        testId="venues-search"
        className="max-w-md"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No venues match your search.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <Link key={v.id} href={`/venues/${v.slug}`}>
              <Card className="overflow-hidden transition-colors hover:border-primary/50">
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
