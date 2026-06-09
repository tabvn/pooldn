"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import { RankingsQuery } from "@/lib/graphql/operations/rankings.operations";

const PAGE = 50;

export function RankingsBoard() {
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const { data, loading, error, fetchMore } = useQuery(RankingsQuery, {
    variables: { first: PAGE },
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  const pages = data?.rankings ?? [];

  async function loadMore() {
    const last = pages[pages.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const r = await fetchMore({
        variables: { after: last.id },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.rankings) return prev;
          return {
            ...prev,
            rankings: [...prev.rankings, ...fetchMoreResult.rankings],
          };
        },
      });
      const next = r.data?.rankings ?? [];
      if (next.length < PAGE) setDone(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading rankings…</p>;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          Could not load rankings: {error.message}
        </CardContent>
      </Card>
    );
  }

  if (pages.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No ranked players yet. Win some frames!
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2" data-testid="rankings-board">
      <ol className="space-y-1.5">
        {pages.map((u, i) => (
          <li key={u.id}>
            <Link
              href={`/players/${u.username}`}
              className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40"
              data-testid={`ranking-row-${i + 1}`}
            >
              <span className="w-8 text-right font-mono text-sm font-bold text-muted-foreground">
                {i + 1}
              </span>
              <Avatar size="md" src={u.avatarUrl ?? undefined} fallback={u.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {u.name}
                  {u.nationality ? (
                    <CountryFlag code={u.nationality} className="text-sm leading-none" />
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  @{u.username}
                  {u.city ? <span> · {u.city.name}</span> : null}
                </div>
              </div>
              <Badge variant="neutral" size="sm">Lv {u.level}</Badge>
              <span className="font-mono text-sm font-bold text-primary tabular-nums">
                {u.rating}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {!done && pages.length >= PAGE ? (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            loading={loadingMore}
            onClick={loadMore}
            data-testid="rankings-load-more"
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
