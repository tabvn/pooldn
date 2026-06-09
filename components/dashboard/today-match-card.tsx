import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { MatchStatusChip } from "@/components/ui/status-chip";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LocalDateTime } from "@/components/ui/local-datetime";
import type { MatchStatus } from "@/lib/generated/prisma/enums";

export type TodayMatch = {
  id: string;
  status: MatchStatus;
  scheduledAt?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeTeam?: { id: string; name: string; logoUrl?: string | null } | null;
  awayTeam?: { id: string; name: string; logoUrl?: string | null } | null;
  venue?: { id: string; name: string } | null;
  matchday: {
    number: number;
    competition: {
      name: string;
      slug: string;
      bannerUrl?: string | null;
    };
  };
};

export function TodayMatchCard({ match }: { match: TodayMatch }) {
  return (
    <Link href={`/matches/${match.id}`} data-testid="today-match-card">
      <Card className="overflow-hidden hover:border-primary/50 transition-colors">
        <CardHeader className="border-b-0 pb-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
            <span>Today&apos;s match</span>
            <span className="inline-flex items-center gap-2 normal-case tracking-normal">
              <Avatar
                size="sm"
                src={match.matchday.competition.bannerUrl ?? undefined}
                fallback={match.matchday.competition.name}
                shape="competition"
              />
              <span>
                {match.matchday.competition.name} · Matchday{" "}
                {match.matchday.number}
              </span>
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-center gap-8 py-4">
            <TeamSide
              name={match.homeTeam?.name ?? "TBD"}
              logo={match.homeTeam?.logoUrl ?? null}
            />
            <div className="text-center">
              {match.homeScore != null && match.awayScore != null ? (
                <span className="font-mono text-2xl font-bold tabular-nums">
                  {match.homeScore} – {match.awayScore}
                </span>
              ) : (
                <span className="text-2xl text-muted-foreground">vs</span>
              )}
              <div className="mt-2">
                <MatchStatusChip status={match.status} />
              </div>
            </div>
            <TeamSide
              name={match.awayTeam?.name ?? "TBD"}
              logo={match.awayTeam?.logoUrl ?? null}
            />
          </div>
          <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">
            {match.venue?.name ?? "Venue TBD"}
            {match.scheduledAt ? (
              <LocalDateTime value={match.scheduledAt} prefix=" · " />
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function TeamSide({
  name,
  logo,
}: {
  name: string;
  logo?: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-2 min-w-32">
      <Avatar size="lg" src={logo ?? undefined} fallback={name} />
      <span className="text-sm font-semibold text-center">{name}</span>
    </div>
  );
}
