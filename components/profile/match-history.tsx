import Link from "next/link";
import { CalendarDays, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { cn } from "@/lib/utils";

/**
 * Round-90 — a player's matches on their profile, scheduled and played.
 *
 * Identical for a real account and an unclaimed placeholder: the placeholder is
 * rostered and named in frames like anyone else, so it has a fixture list and a
 * results list, and both follow the profile into the claimant's account when
 * the claim is approved.
 */

type Side = "HOME" | "AWAY" | null;

type MatchTeam = { id: string; name: string; slug: string; logoUrl?: string | null } | null;
type MatchPlayer = {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  isShell?: boolean;
} | null;

export type PlayerMatchItem = {
  side: Side;
  played: boolean;
  framesPlayed?: number;
  framesWon?: number;
  match: {
    id: string;
    status: string;
    scheduledAt?: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
    matchday: {
      number: number;
      competition: { id: string; slug: string; name: string; type: string };
    };
    venue?: { id: string; name: string } | null;
    homeTeam: MatchTeam;
    awayTeam: MatchTeam;
    homePlayer: MatchPlayer;
    awayPlayer: MatchPlayer;
  };
};

/** The two sides, resolved for either format. */
function sides(m: PlayerMatchItem["match"]) {
  const home = m.homeTeam
    ? { name: m.homeTeam.name, logo: m.homeTeam.logoUrl, ghost: false }
    : m.homePlayer
      ? {
          name: m.homePlayer.name,
          logo: m.homePlayer.avatarUrl,
          ghost: !!m.homePlayer.isShell,
        }
      : { name: "TBD", logo: null, ghost: false };
  const away = m.awayTeam
    ? { name: m.awayTeam.name, logo: m.awayTeam.logoUrl, ghost: false }
    : m.awayPlayer
      ? {
          name: m.awayPlayer.name,
          logo: m.awayPlayer.avatarUrl,
          ghost: !!m.awayPlayer.isShell,
        }
      : { name: "TBD", logo: null, ghost: false };
  return { home, away, isTeamMatch: !!m.homeTeam || !!m.awayTeam };
}

function MatchRow({ item }: { item: PlayerMatchItem }) {
  const m = item.match;
  const { home, away, isTeamMatch } = sides(m);
  const mine = item.side;
  const us = mine === "AWAY" ? m.awayScore : m.homeScore;
  const them = mine === "AWAY" ? m.homeScore : m.awayScore;
  // Status wins over stale numbers: a match that was reopened or postponed can
  // still carry the old score, and showing "3–1 Won" on something labelled
  // Scheduled reads as a bug.
  const decided =
    us != null &&
    them != null &&
    m.status !== "SCHEDULED" &&
    m.status !== "POSTPONED";
  const won = decided ? us > them : null;
  const drew = decided ? us === them : false;

  return (
    <Link
      href={`/matches/${m.id}`}
      data-testid={`profile-match-${m.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:border-primary/40"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar
            size="xs"
            src={home.logo ?? undefined}
            fallback={home.name}
            shape={isTeamMatch ? "team" : "user"}
            ghost={home.ghost}
          />
          <span
            className={cn(
              "truncate text-sm",
              mine === "HOME" ? "font-semibold" : "text-muted-foreground",
            )}
          >
            {home.name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">vs</span>
          <Avatar
            size="xs"
            src={away.logo ?? undefined}
            fallback={away.name}
            shape={isTeamMatch ? "team" : "user"}
            ghost={away.ghost}
          />
          <span
            className={cn(
              "truncate text-sm",
              mine === "AWAY" ? "font-semibold" : "text-muted-foreground",
            )}
          >
            {away.name}
          </span>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          <Link
            href={`/competitions/${m.matchday.competition.slug}`}
            className="hover:underline"
          >
            {m.matchday.competition.name}
          </Link>
          {" · "}
          Matchday {m.matchday.number}
          {m.scheduledAt ? (
            <>
              {" · "}
              <LocalDateTime value={m.scheduledAt} variant="datetime" />
            </>
          ) : null}
          {m.venue ? ` · ${m.venue.name}` : ""}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {decided ? (
          <span className="font-mono text-sm font-bold tabular-nums">
            {us}–{them}
          </span>
        ) : (
          <Badge variant="neutral" size="sm">
            {m.status === "IN_PROGRESS" ? "Live" : "Scheduled"}
          </Badge>
        )}
        {decided && item.played ? (
          <Badge
            variant={won ? "success" : drew ? "neutral" : "danger"}
            size="sm"
          >
            {won ? "Won" : drew ? "Draw" : "Lost"}
          </Badge>
        ) : decided ? (
          // Their team played it, they weren't in the lineup — show the
          // fixture, but don't credit them with the result.
          <Badge variant="outline" size="sm">
            Did not play
          </Badge>
        ) : null}
        {item.played && (item.framesPlayed ?? 0) > 0 ? (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {item.framesWon}/{item.framesPlayed} frames
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function MatchHistory({
  upcoming,
  past,
  playedCount,
  isShell,
  isSelf,
  name,
}: {
  upcoming: PlayerMatchItem[];
  past: PlayerMatchItem[];
  playedCount: number;
  isShell: boolean;
  isSelf: boolean;
  name: string;
}) {
  const nobody = upcoming.length === 0 && past.length === 0;

  return (
    <Card data-testid="profile-match-history">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Matches</CardTitle>
          {playedCount > 0 ? (
            <Badge variant="neutral" size="sm">
              {playedCount} played
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {nobody ? (
          <p className="text-sm text-muted-foreground">
            {isSelf
              ? "You haven't been scheduled for a match yet."
              : isShell
                ? `No matches recorded for ${name} yet.`
                : "This player hasn't been scheduled for a match yet."}
          </p>
        ) : null}

        {upcoming.length > 0 ? (
          <section className="space-y-2" data-testid="profile-matches-upcoming">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <CalendarDays className="size-3.5" />
              Scheduled
            </h3>
            {upcoming.map((item) => (
              <MatchRow key={item.match.id} item={item} />
            ))}
          </section>
        ) : null}

        {past.length > 0 ? (
          <section className="space-y-2" data-testid="profile-matches-past">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Trophy className="size-3.5" />
              Results
            </h3>
            {past.map((item) => (
              <MatchRow key={item.match.id} item={item} />
            ))}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
