import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { getClient } from "@/lib/apollo/client";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";

export default async function TeamMatchesPage({
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

  const matches = [...team.homeMatches, ...team.awayMatches].sort((a, b) => {
    const av = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const bv = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    return bv - av;
  });

  return (
    <Card data-testid="team-matches">
      <CardHeader>
        <CardTitle>Matches · {matches.length}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches yet.</p>
        ) : (
          matches.map((m) => {
            const homeName = m.homeTeam?.name ?? "TBD";
            const awayName = m.awayTeam?.name ?? "TBD";
            const isHome = m.homeTeam?.id === team.id;
            const us = isHome ? m.homeScore : m.awayScore;
            const them = isHome ? m.awayScore : m.homeScore;
            const won = us != null && them != null ? us > them : null;
            return (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-primary/40"
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
                    {m.matchday.competition.name} · Matchday {m.matchday.number}
                    {m.scheduledAt ? (
                      <>
                        {" · "}
                        <LocalDateTime value={m.scheduledAt} variant="date" />
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
          })
        )}
      </CardContent>
    </Card>
  );
}
