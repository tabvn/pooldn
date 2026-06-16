"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client/react";
import type { ResultOf } from "@graphql-typed-document-node/core";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import { FollowedTeamsQuery } from "@/lib/graphql/operations/follow.operations";

type TeamRow = NonNullable<
  ResultOf<typeof FollowedTeamsQuery>["followedTeams"]
>[number];

const PAGE = 30;

/**
 * Round-50 — followed-teams tab on /players/[username]/following.
 */
export function FollowedTeamsList({ userId }: { userId: string }) {
  const [pages, setPages] = useState<TeamRow[]>([]);
  const [done, setDone] = useState(false);
  const { data, loading, fetchMore } = useQuery(FollowedTeamsQuery, {
    variables: { userId, first: PAGE },
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (data?.followedTeams) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPages(data.followedTeams);
      setDone(data.followedTeams.length < PAGE);
    }
  }, [data]);

  async function loadMore() {
    const last = pages[pages.length - 1];
    if (!last) return;
    const res = await fetchMore({ variables: { after: last.id } });
    const next = res.data?.followedTeams ?? [];
    setPages((prev) => [...prev, ...next]);
    if (next.length < PAGE) setDone(true);
  }

  if (loading && pages.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading teams…</p>;
  }

  if (pages.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
        Not following any teams yet.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="followed-teams-list">
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {pages.map((t) => (
          <li key={t.id}>
            <Link
              href={`/teams/${t.slug}`}
              className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40"
            >
              <Avatar
                size="md"
                src={t.logoUrl ?? undefined}
                fallback={t.name}
                shape="team"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{t.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  Captain {t.captain.name}
                  <CountryFlag
                    code={t.captain.nationality}
                    className="ml-1 leading-none"
                  />{" "}
                  · {t.members.length} member
                  {t.members.length === 1 ? "" : "s"}
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
            data-testid="followed-teams-load-more"
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
