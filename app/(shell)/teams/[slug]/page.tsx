import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompetitionStatusChip } from "@/components/ui/status-chip";
import { CaptainJoinRequestsPanel } from "@/components/team/captain-join-requests-panel";
import { getClient } from "@/lib/apollo/client";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";

/**
 * Round-24 — Overview tab: a quick at-a-glance summary. Roster preview,
 * recent competitions, recent matches; deep dives live on dedicated tabs.
 */
export default async function TeamOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await getClient().query({
    query: TeamDetailQuery,
    variables: { slug },
  });
  const team = data?.team;
  if (!team) notFound();

  const roster = team.members.slice(0, 6);
  const competitions = team.applications
    .map((a) => a.competition)
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
    .slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <CaptainJoinRequestsPanel
        teamId={team.id}
        teamSlug={slug}
        captainId={team.captain.id}
      />
      <Card data-testid="overview-roster">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Roster</CardTitle>
            <Link
              href={`/teams/${slug}/roster`}
              className="text-xs text-primary hover:underline"
            >
              See all →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {roster.map((m) => (
            <Link
              key={m.id}
              href={`/players/${m.user.username}`}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-secondary/40"
            >
              <Avatar
                size="sm"
                src={m.user.avatarUrl ?? undefined}
                fallback={m.user.name}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{m.user.name}</div>
                <div className="text-xs text-muted-foreground">
                  @{m.user.username}
                </div>
              </div>
              {m.user.id === team.captain.id ? (
                <Badge variant="primary" size="sm">
                  Captain
                </Badge>
              ) : null}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="overview-competitions">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent competitions</CardTitle>
            <Link
              href={`/teams/${slug}/competitions`}
              className="text-xs text-primary hover:underline"
            >
              See all →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {competitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No competitions yet.</p>
          ) : (
            competitions.map((c) => (
              <Link
                key={c.id}
                href={`/competitions/${c.slug}`}
                className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40"
              >
                <Avatar
                  size="sm"
                  src={c.bannerUrl ?? undefined}
                  fallback={c.name}
                  shape="competition"
                />
                <div className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {c.name}
                </div>
                <CompetitionStatusChip status={c.status} />
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
