import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchStatusChip } from "@/components/ui/status-chip";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { GenerateMatchdaysButton } from "@/components/competition/generate-matchdays-button";
import { getClient } from "@/lib/apollo/client";
import {
  CompetitionHeaderQuery,
  CompetitionMatchdaysQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";

export default async function MatchdaysPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = getClient();
  const [matchdaysRes, headerRes, viewerRes] = await Promise.all([
    client.query({ query: CompetitionMatchdaysQuery, variables: { slug } }),
    client.query({ query: CompetitionHeaderQuery, variables: { slug } }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
  ]);
  const c = matchdaysRes.data?.competition;
  const header = headerRes.data?.competition;
  const viewer = viewerRes.data?.viewer ?? null;
  if (!c || !header) return null;

  const isAdmin = viewer?.role === "SUPER_ADMIN";
  const owns = !!viewer && viewer.id === header.organizer.id;
  const canManage = isAdmin || owns;

  if (c.matchdays.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No matchdays have been generated yet.
        </p>
        {canManage ? (
          <GenerateMatchdaysButton competitionId={header.id} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {c.matchdays.map((md) => (
        <Card key={md.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Matchday {md.number}
                {md.label ? ` — ${md.label}` : ""}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {md.scheduledDate ? (
                  <LocalDateTime value={md.scheduledDate} variant="date" />
                ) : (
                  "TBD"
                )}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {md.matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches yet.</p>
            ) : (
              md.matches.map((m) => (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3 hover:border-primary/50 transition-colors"
                >
                  <div className="flex flex-1 items-center gap-3">
                    <span className="font-semibold">
                      {m.homeTeam?.name ?? "TBD"}
                    </span>
                    <span className="text-muted-foreground">vs</span>
                    <span className="font-semibold">
                      {m.awayTeam?.name ?? "TBD"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.homeScore != null && m.awayScore != null ? (
                      <span className="font-mono text-base font-bold">
                        {m.homeScore} – {m.awayScore}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {m.venue?.name ?? "Venue TBD"}
                      </span>
                    )}
                    <MatchStatusChip status={m.status} />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
