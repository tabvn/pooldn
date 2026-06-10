"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client/react";
import type { ResultOf } from "@graphql-typed-document-node/core";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompetitionStatusChip } from "@/components/ui/status-chip";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { FollowedCompetitionsQuery } from "@/lib/graphql/operations/follow.operations";

type CompRow = NonNullable<
  ResultOf<typeof FollowedCompetitionsQuery>["followedCompetitions"]
>[number];

const PAGE = 30;

/**
 * Round-50 — followed-competitions tab on /players/[username]/following.
 * CASL-filtered on the server so DRAFT/CANCELLED comps don't leak to
 * non-organizers even if the user is technically following them.
 */
export function FollowedCompetitionsList({ userId }: { userId: string }) {
  const [pages, setPages] = useState<CompRow[]>([]);
  const [done, setDone] = useState(false);
  const { data, loading, fetchMore } = useQuery(FollowedCompetitionsQuery, {
    variables: { userId, first: PAGE },
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (data?.followedCompetitions) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPages(data.followedCompetitions);
      setDone(data.followedCompetitions.length < PAGE);
    }
  }, [data]);

  async function loadMore() {
    const last = pages[pages.length - 1];
    if (!last) return;
    const res = await fetchMore({ variables: { after: last.id } });
    const next = res.data?.followedCompetitions ?? [];
    setPages((prev) => [...prev, ...next]);
    if (next.length < PAGE) setDone(true);
  }

  if (loading && pages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Loading competitions…</p>
    );
  }

  if (pages.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
        Not following any competitions yet.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="followed-competitions-list">
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {pages.map((c) => (
          <li key={c.id}>
            <Link
              href={`/competitions/${c.slug}`}
              className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40"
            >
              <Avatar
                size="md"
                src={c.bannerUrl ?? undefined}
                fallback={c.name}
                shape="competition"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">
                    {c.name}
                  </span>
                  <CompetitionStatusChip status={c.status} />
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {String(c.gameType).replace(/_/g, "-").toLowerCase()}
                  {c.city ? ` · ${c.city.name}` : ""}
                  {c.startDate ? (
                    <>
                      {" · "}
                      <LocalDateTime value={c.startDate} variant="date" />
                    </>
                  ) : null}
                </div>
              </div>
              <Badge variant="primary" size="sm">
                Following
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
      {!done ? (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            loading={loading}
            onClick={loadMore}
            data-testid="followed-competitions-load-more"
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
