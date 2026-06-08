import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { CompetitionStatusChip } from "@/components/ui/status-chip";
import { FollowButton } from "@/components/follow-button";
import { PageTitle } from "@/components/layout/page-title";
import { JoinTeamButton } from "@/components/team/join-team-button";
import { LeaveTeamButton } from "@/components/team/leave-team-button";
import { getClient } from "@/lib/apollo/client";
import { getViewer } from "@/lib/auth/server";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ data }, viewer] = await Promise.all([
    getClient().query({ query: TeamDetailQuery, variables: { slug } }),
    getViewer(),
  ]);
  const team = data?.team;
  if (!team) notFound();
  const isAdmin = viewer?.role === "SUPER_ADMIN";
  const isCaptain = viewer?.id === team.captain.id;
  const canManage = isAdmin || isCaptain;
  const isMember = team.members.some((m) => m.user.id === viewer?.id);
  const canRequestToJoin = !!viewer && !isMember && !isCaptain;

  // Round-16 — team's competitions + match history.
  const allMatches = [...team.homeMatches, ...team.awayMatches].sort(
    (a, b) => {
      const av = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bv = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return bv - av;
    },
  );
  const recentMatches = allMatches.slice(0, 6);
  const competitions = team.applications
    .map((a) => a.competition)
    .filter(
      (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i,
    )
    .slice(0, 8);

  return (
    <div className="flex flex-col">
      <PageTitle
        title={team.name}
        eyebrow={
          <span className="flex items-center gap-3">
            <Avatar
              size="sm"
              src={team.logoUrl ?? undefined}
              fallback={team.name}
              shape="team"
            />
            Team
          </span>
        }
        description={team.description}
        actions={
          <div className="flex items-center gap-2">
            <FollowButton
              entityType="TEAM"
              entityId={team.id}
              isFollowing={team.isFollowing}
              followerCount={team.followerCount}
              signedIn={!!viewer}
            />
            {canManage ? (
              <Link href={`/teams/${slug}/manage`}>
                <Button variant="outline">Manage roster</Button>
              </Link>
            ) : null}
            {canRequestToJoin ? (
              <JoinTeamButton teamId={team.id} teamName={team.name} />
            ) : null}
            {isMember && !isCaptain ? (
              <LeaveTeamButton teamId={team.id} teamName={team.name} />
            ) : null}
          </div>
        }
        meta={
          <>
            <span>Captain: {team.captain.name}</span>
            <Badge variant="primary">
              {team.members.length}{" "}
              {team.members.length === 1 ? "member" : "members"}
            </Badge>
            {!team.isActive ? (
              <Badge variant="neutral">inactive</Badge>
            ) : null}
          </>
        }
      />
      <div className="p-8 space-y-6">
        {/* Roster */}
        <Card>
          <CardHeader>
            <CardTitle>Roster</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {team.members.map((m) => (
              <Link
                key={m.id}
                href={`/players/${m.user.username}`}
                className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40 transition-colors"
              >
                <Avatar
                  size="md"
                  src={m.user.avatarUrl ?? undefined}
                  fallback={m.user.name}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {m.user.name}
                    {m.user.nationality ? (
                      <CountryFlag
                        code={m.user.nationality}
                        className="text-base leading-none"
                      />
                    ) : null}
                  </div>
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

        {/* Competitions */}
        {competitions.length > 0 ? (
          <Card data-testid="team-competitions">
            <CardHeader>
              <CardTitle>Competitions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {competitions.map((c) => (
                <Link
                  key={c.id}
                  href={`/competitions/${c.slug}`}
                  className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40 transition-colors"
                >
                  <Avatar
                    size="sm"
                    src={c.bannerUrl ?? undefined}
                    fallback={c.name}
                    shape="competition"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {c.name}
                    </div>
                  </div>
                  <CompetitionStatusChip status={c.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {/* Match history */}
        {recentMatches.length > 0 ? (
          <Card data-testid="team-match-history">
            <CardHeader>
              <CardTitle>Recent matches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentMatches.map((m) => {
                const homeName = m.homeTeam?.name ?? "TBD";
                const awayName = m.awayTeam?.name ?? "TBD";
                const isHome = m.homeTeam?.id === team.id;
                const us = isHome ? m.homeScore : m.awayScore;
                const them = isHome ? m.awayScore : m.homeScore;
                const won =
                  us != null && them != null ? us > them : null;
                return (
                  <Link
                    key={m.id}
                    href={`/matches/${m.id}`}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-primary/40 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span>
                        <span
                          className={
                            isHome ? "font-semibold" : "text-muted-foreground"
                          }
                        >
                          {homeName}
                        </span>{" "}
                        vs{" "}
                        <span
                          className={
                            !isHome ? "font-semibold" : "text-muted-foreground"
                          }
                        >
                          {awayName}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {m.matchday.competition.name} · Matchday{" "}
                        {m.matchday.number}
                        {m.scheduledAt ? (
                          <>
                            {" · "}
                            <LocalDateTime
                              value={m.scheduledAt}
                              variant="date"
                            />
                          </>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.homeScore != null && m.awayScore != null ? (
                        <span className="font-mono text-sm font-bold tabular-nums">
                          {m.homeScore} – {m.awayScore}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {m.status.replace(/_/g, " ").toLowerCase()}
                        </span>
                      )}
                      {won === true ? (
                        <Badge variant="success" size="sm">
                          W
                        </Badge>
                      ) : won === false ? (
                        <Badge variant="warning" size="sm">
                          L
                        </Badge>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
