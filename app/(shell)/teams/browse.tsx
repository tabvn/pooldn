"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import { SearchInput } from "@/components/ui/search-input";
import { MyTeamsQuery } from "@/lib/graphql/operations/team.operations";

type Team = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
  memberCount: number;
  captain: {
    id: string;
    name: string;
    username: string;
    nationality?: string | null;
  };
};

const PAGE = 12;

/**
 * Round-39 — paginated, sortable, search-filterable Teams browse.
 *
 * Excludes teams the viewer is already on (rendered by <MyTeamsBand> above
 * the grid) so the grid is a true "discover other teams" surface — fixes
 * the duplicate-listing complaint.
 *
 * Round-56 — the whole card is the link to the team page now; the
 * standalone "View team" button was redundant inside an already-tappable
 * card.
 */
export function TeamsBrowse({
  teams,
  viewerId,
  canCreate,
}: {
  teams: Team[];
  viewerId: string | null;
  canCreate: boolean;
}) {
  const [visible, setVisible] = useState(PAGE);
  const [q, setQ] = useState("");

  // Pull the viewer's teams so we can exclude them from the discover grid.
  const { data } = useQuery(MyTeamsQuery, { skip: !viewerId });
  const myTeamIds = useMemo(
    () => new Set((data?.myTeams ?? []).map((t) => t.id)),
    [data],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return teams
      .filter((t) => !myTeamIds.has(t.id))
      .filter(
        (t) =>
          !needle ||
          t.name.toLowerCase().includes(needle) ||
          t.captain.name.toLowerCase().includes(needle) ||
          t.captain.username.toLowerCase().includes(needle),
      )
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, myTeamIds, q]);

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No teams yet.</p>
          {canCreate ? (
            <Link href="/teams/new">
              <Button>Create the first team</Button>
            </Link>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4" data-testid="teams-browse">
      {/* Discover banner */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Discover other teams</h2>
        <span className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "team" : "teams"}
        </span>
      </div>

      <SearchInput
        value={q}
        onChange={(v) => {
          setQ(v);
          setVisible(PAGE);
        }}
        placeholder="Search teams or captains…"
        testId="teams-search"
      />

      {/* Grid */}
      {shown.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {q ? "No teams match your search." : "No other teams to discover yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => (
            <Link
              key={t.id}
              href={`/teams/${t.slug}`}
              data-testid={`team-card-${t.slug}`}
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
            >
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Avatar
                      size="lg"
                      src={t.logoUrl ?? undefined}
                      fallback={t.name}
                      shape="team"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="primary" size="sm">
                          {t.memberCount}{" "}
                          {t.memberCount === 1 ? "member" : "members"}
                        </Badge>
                        {!t.isActive ? (
                          <Badge variant="neutral" size="sm">
                            inactive
                          </Badge>
                        ) : null}
                      </div>
                      <CardTitle className="text-primary mt-1 truncate">
                        {t.name}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Captain {t.captain.name}
                  <CountryFlag
                    code={t.captain.nationality}
                    className="ml-1 leading-none"
                  />{" "}
                  <span className="text-muted-foreground/70">
                    @{t.captain.username}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => setVisible((v) => v + PAGE)}
            data-testid="teams-load-more"
          >
            Load more
          </Button>
        </div>
      ) : null}
    </section>
  );
}
