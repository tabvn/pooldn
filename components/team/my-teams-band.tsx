"use client";

import Link from "next/link";
import { useQuery } from "@apollo/client/react";
import { Crown, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MyTeamsQuery } from "@/lib/graphql/operations/team.operations";

/**
 * Round-29 — 'Your teams' band: the teams the viewer is on, with a Manage
 * shortcut for the ones they captain. Empty state nudges them to create one
 * (Round-30 — any signed-in non-VIEWER can create a team).
 */
export function MyTeamsBand() {
  const { data, loading } = useQuery(MyTeamsQuery, {
    fetchPolicy: "cache-and-network",
  });
  if (loading && !data) return null;
  const viewerId = data?.viewer?.id;
  if (!viewerId) return null;
  const teams = data?.myTeams ?? [];

  if (teams.length === 0) {
    return (
      <Card data-testid="my-teams-empty">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <Users className="size-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">You're not on a team yet</p>
            <p className="text-xs text-muted-foreground">
              Create one and become its captain, or ask a captain to invite you.
            </p>
          </div>
          <Link href="/teams/new">
            <Button size="sm">Create team</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-3" data-testid="my-teams-band">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Your teams</h2>
        <span className="text-xs text-muted-foreground">
          {teams.length} {teams.length === 1 ? "team" : "teams"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((t) => {
          const isCaptain = t.captain.id === viewerId;
          return (
            <Card
              key={t.id}
              className="hover:border-primary/50 transition-colors"
              data-testid={`my-team-${t.slug}`}
            >
              <CardContent className="flex items-center gap-3 py-3">
                <Avatar size="lg" src={t.logoUrl ?? undefined} fallback={t.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/teams/${t.slug}`}
                      className="truncate font-semibold hover:underline"
                    >
                      {t.name}
                    </Link>
                    {isCaptain ? (
                      <Badge variant="primary" size="sm">
                        <Crown className="size-3" /> Captain
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Member
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.members.length}{" "}
                    {t.members.length === 1 ? "member" : "members"}
                  </div>
                </div>
                {isCaptain ? (
                  <Link href={`/teams/${t.slug}/manage`}>
                    <Button size="sm" variant="outline">
                      Manage
                    </Button>
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
