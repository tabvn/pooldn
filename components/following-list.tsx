"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client/react";
import type { ResultOf } from "@graphql-typed-document-node/core";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import { FollowingQuery } from "@/lib/graphql/operations/follow.operations";

type FollowingRow = NonNullable<
  ResultOf<typeof FollowingQuery>["following"]
>[number];

const PAGE = 30;

/**
 * Round-50 — "Following" companion to FollowerList. Lists the players that
 * a given user follows. Cursor-paginated by Follow.id (newest first); the
 * server returns User rows in the same order.
 */
export function FollowingList({ userId }: { userId: string }) {
  const [pages, setPages] = useState<FollowingRow[]>([]);
  const [done, setDone] = useState(false);
  const { data, loading, fetchMore } = useQuery(FollowingQuery, {
    variables: { userId, first: PAGE },
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (data?.following) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPages(data.following);
      setDone(data.following.length < PAGE);
    }
  }, [data]);

  async function loadMore() {
    const last = pages[pages.length - 1];
    if (!last) return;
    const res = await fetchMore({ variables: { after: last.id } });
    const next = res.data?.following ?? [];
    setPages((prev) => [...prev, ...next]);
    if (next.length < PAGE) setDone(true);
  }

  if (loading && pages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Loading following…</p>
    );
  }

  if (pages.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
        Not following anyone yet.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="following-list">
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {pages.map((u) => (
          <li key={u.id}>
            <Link
              href={`/players/${u.username}`}
              className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40"
            >
              <Avatar
                size="md"
                src={u.avatarUrl ?? undefined}
                fallback={u.name}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {u.name}
                  {u.nationality ? (
                    <CountryFlag
                      code={u.nationality}
                      className="text-sm leading-none"
                    />
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  @{u.username}
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
            data-testid="following-load-more"
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
