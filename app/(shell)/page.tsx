import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CompetitionCard } from "@/components/competition/competition-card";
import { TodayMatchCard } from "@/components/dashboard/today-match-card";
import { getClient } from "@/lib/apollo/client";
import { DashboardQuery } from "@/lib/graphql/operations/dashboard.operations";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";

function firstName(full?: string | null) {
  if (!full) return null;
  return full.trim().split(/\s+/)[0];
}

export default async function PoolhubDashboard() {
  const client = getClient();
  const [{ data }, viewerResult] = await Promise.all([
    client.query({ query: DashboardQuery, errorPolicy: "ignore" }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
  ]);
  const viewer = data?.viewer ?? viewerResult.data?.viewer ?? null;
  const nextMatch = data?.viewerNextMatch ?? null;
  const upcoming = data?.upcoming ?? [];
  const active = data?.active ?? [];
  const followedComps = data?.myFollowedCompetitions ?? [];
  const followedTeams = data?.myFollowedTeams ?? [];
  const hasFollowing = followedComps.length > 0 || followedTeams.length > 0;
  const canCreate =
    viewer?.role === "ORGANIZER" || viewer?.role === "SUPER_ADMIN";
  const greetingName = firstName(viewer?.name);

  return (
    <div className="p-8 space-y-8">
      {/* Greeting */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-primary">
            {greetingName
              ? `Welcome back, ${greetingName}!`
              : "Welcome to PoolDN"}
          </h1>
          <p className="text-sm text-muted-foreground">Ready to compete?</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate ? (
            <Link href="/competitions/new">
              <Button>Create competition</Button>
            </Link>
          ) : null}
          <Link href="/competitions">
            <Button variant="outline">Browse all</Button>
          </Link>
        </div>
      </header>

      {/* Today's match */}
      {nextMatch ? (
        <TodayMatchCard match={nextMatch} />
      ) : viewer ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground">
          You have no scheduled matches right now. Browse competitions below to
          get in the action.
        </div>
      ) : null}

      {/* Upcoming Competitions */}
      <section className="space-y-3">
        <SectionHeader
          title="Upcoming competitions"
          href="/competitions?status=OPEN_FOR_APPLICATIONS"
        />
        {upcoming.length === 0 ? (
          <EmptyMessage>
            No competitions are accepting applications right now.
          </EmptyMessage>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.slice(0, 3).map((c) => (
              <CompetitionCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>

      {/* Active Competitions */}
      <section className="space-y-3">
        <SectionHeader
          title="Active competitions"
          href="/competitions?status=ONGOING"
        />
        {active.length === 0 ? (
          <EmptyMessage>No active competitions yet.</EmptyMessage>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.slice(0, 3).map((c) => (
              <CompetitionCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>

      {/* Following */}
      {viewer && hasFollowing ? (
        <section className="space-y-3" data-testid="dashboard-following">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Following</h2>
            <span className="text-xs text-muted-foreground">
              {followedComps.length + followedTeams.length} item
              {followedComps.length + followedTeams.length === 1 ? "" : "s"}
            </span>
          </div>
          {followedComps.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {followedComps.slice(0, 3).map((c) => (
                <CompetitionCard key={c.id} c={c} />
              ))}
            </div>
          ) : null}
          {followedTeams.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {followedTeams.slice(0, 6).map((t) => (
                <Link
                  key={t.id}
                  href={`/teams/${t.slug}`}
                  data-testid={`followed-team-${t.slug}`}
                >
                  <Card className="hover:border-primary/50 transition-colors">
                    <CardContent className="flex items-center gap-3 py-3">
                      <Avatar
                        size="md"
                        src={t.logoUrl ?? undefined}
                        fallback={t.name}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {t.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          @{t.captain.username} ·{" "}
                          {t.members.length} member
                          {t.members.length === 1 ? "" : "s"}
                        </div>
                      </div>
                      <Badge variant="neutral" size="sm">
                        Team
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Link
        href={href}
        className="text-sm font-semibold text-primary hover:underline"
      >
        View all
      </Link>
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border bg-card/40 px-4 py-6 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
