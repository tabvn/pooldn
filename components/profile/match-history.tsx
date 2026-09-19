"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, Trophy } from "lucide-react";
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
      competition: {
        id: string;
        slug: string;
        name: string;
        type: string;
        schedulingType?: string | null;
      };
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

/** Round-94 — one side of the scoreboard. `end` mirrors it for the away team. */
function SideCell({
  side,
  align,
  isTeamMatch,
  mine,
  won,
}: {
  side: { name: string; logo?: string | null; ghost: boolean };
  align: "start" | "end";
  isTeamMatch: boolean;
  mine: boolean;
  won: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        // Reversing the row puts the avatar on the outside edge, so the two
        // sides mirror each other around the score.
        align === "end" && "flex-row-reverse",
      )}
    >
      <Avatar
        size="sm"
        src={side.logo ?? undefined}
        fallback={side.name}
        shape={isTeamMatch ? "team" : "user"}
        ghost={side.ghost}
        // On a phone the avatar costs about four characters of the name
        // beside it, and for a real player it only repeats what the name
        // already says. A placeholder's ghost ring doesn't — that one is the
        // only mark saying this isn't a real account, so it stays at every
        // width.
        className={cn(!side.ghost && "hidden sm:inline-flex")}
      />
      <span
        className={cn(
          // A phone gives each side about nine characters once the avatar,
          // badge and score have taken their share, which cuts "Gen Filling
          // Station" to "Gen Fi…". Wrapping to two lines keeps the name
          // readable there; from sm up there is room for one clean line.
          "line-clamp-2 text-sm leading-tight sm:truncate sm:leading-normal",
          align === "end" && "text-right sm:text-left",
          // Colour says whose side this is, the badge says who won — two
          // separate questions, so they don't share the same signal.
          mine ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {side.name}
      </span>
      {won ? (
        <Badge
          variant="success"
          size="sm"
          // Icon-only under sm: at 390px every pixel spent here comes
          // straight out of the name beside it.
          className="shrink-0 px-1 sm:px-1.5"
          title="Winner"
        >
          <Trophy className="size-3" />
          <span className="hidden sm:inline">Won</span>
        </Badge>
      ) : null}
    </div>
  );
}

/**
 * Round-94 — a scoreboard row: the two sides on the outside, the result in
 * the middle, the winner badged.
 *
 * The score reads home–away here rather than from the profile owner's
 * perspective. Once the names sit beside it, a viewer-relative "3–1" next to
 * the losing side's name is simply wrong, and the owner's own side is already
 * legible from its colour.
 */
function MatchRow({ item }: { item: PlayerMatchItem }) {
  const m = item.match;
  const { home, away, isTeamMatch } = sides(m);
  const mine = item.side;
  // Status wins over stale numbers: a match that was reopened or postponed can
  // still carry the old score, and showing "3–1 Won" on something labelled
  // Scheduled reads as a bug.
  const decided =
    m.homeScore != null &&
    m.awayScore != null &&
    m.status !== "SCHEDULED" &&
    m.status !== "POSTPONED";
  const homeWon = decided && (m.homeScore ?? 0) > (m.awayScore ?? 0);
  const awayWon = decided && (m.awayScore ?? 0) > (m.homeScore ?? 0);
  const drew = decided && m.homeScore === m.awayScore;

  return (
    <Link
      href={`/matches/${m.id}`}
      data-testid={`profile-match-${m.id}`}
      className="block rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:border-primary/40"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-3">
        <SideCell
          side={home}
          align="start"
          isTeamMatch={isTeamMatch}
          mine={mine === "HOME"}
          won={homeWon}
        />
        <div className="flex min-w-10 flex-col items-center gap-0.5 sm:min-w-14">
          {decided ? (
            <span
              className="font-mono text-base font-bold tabular-nums"
              data-testid={`profile-match-score-${m.id}`}
            >
              {m.homeScore}–{m.awayScore}
            </span>
          ) : m.status === "IN_PROGRESS" ? (
            <Badge variant="primary" size="sm">
              Live
            </Badge>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              vs
            </span>
          )}
          {drew ? (
            <Badge variant="neutral" size="sm">
              Draw
            </Badge>
          ) : null}
        </div>
        <SideCell
          side={away}
          align="end"
          isTeamMatch={isTeamMatch}
          mine={mine === "AWAY"}
          won={awayWon}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">
          {m.matchday.competition.name}
          {/* Round-92 — a Free Schedule competition has no matchdays: it
              creates one per match purely to satisfy the schema, so "Matchday
              37" would be noise. */}
          {m.matchday.competition.schedulingType === "FREE_SCHEDULE" ? null : (
            <>
              {" · "}
              Matchday {m.matchday.number}
            </>
          )}
          {m.scheduledAt ? (
            <>
              {" · "}
              <LocalDateTime value={m.scheduledAt} variant="datetime" />
            </>
          ) : null}
          {m.venue ? ` · ${m.venue.name}` : ""}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {item.played && (item.framesPlayed ?? 0) > 0 ? (
            <span className="tabular-nums">
              {item.framesWon}/{item.framesPlayed} frames
            </span>
          ) : null}
          {decided && !item.played ? (
            // Their team played it, they weren't in the lineup — show the
            // fixture, but don't credit them with the result.
            <Badge variant="outline" size="sm">
              Did not play
            </Badge>
          ) : null}
          {m.status === "CANCELLED" ? (
            <Badge variant="danger" size="sm">
              Cancelled
            </Badge>
          ) : m.status === "POSTPONED" ? (
            <Badge variant="warning" size="sm">
              Postponed
            </Badge>
          ) : null}
        </span>
      </div>
    </Link>
  );
}

const PREVIEW = 5;

function MatchSection({
  testId,
  title,
  icon,
  items,
}: {
  testId: string;
  title: string;
  icon: React.ReactNode;
  items: PlayerMatchItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, PREVIEW);
  const hidden = items.length - shown.length;

  return (
    <section className="space-y-2" data-testid={testId}>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
        <span className="font-normal normal-case tracking-normal">
          · {items.length}
        </span>
      </h3>
      {shown.map((item) => (
        <MatchRow key={item.match.id} item={item} />
      ))}
      {hidden > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          data-testid={`${testId}-toggle`}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
          />
          {expanded ? "Show fewer" : `Show all ${items.length}`}
        </button>
      ) : null}
    </section>
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
          <MatchSection
            testId="profile-matches-upcoming"
            title="Scheduled"
            icon={<CalendarDays className="size-3.5" />}
            items={upcoming}
          />
        ) : null}

        {past.length > 0 ? (
          <MatchSection
            testId="profile-matches-past"
            title="Results"
            icon={<Trophy className="size-3.5" />}
            items={past}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
