"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { MatchStatus } from "@/lib/generated/prisma/enums";

export type TodayMatch = {
  id: string;
  status: MatchStatus;
  scheduledAt?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeLineupSubmittedAt?: string | null;
  awayLineupSubmittedAt?: string | null;
  homeTeam?: { id: string; name: string; logoUrl?: string | null } | null;
  awayTeam?: { id: string; name: string; logoUrl?: string | null } | null;
  venue?: { id: string; name: string } | null;
  matchday: {
    number: number;
    competition: {
      name: string;
      slug: string;
      bannerUrl?: string | null;
      raceToFrames?: number | null;
    };
  };
};

/**
 * Round-50 (v4) — restrained, typography-led match card.
 *
 * No gradients, no banner backdrop, no stripe. The card is a clean
 * surface and lets the score + team names carry the visual weight. State
 * is communicated through one tiny, semantic chip near the score and the
 * tone of the kickoff line. Designed to sit comfortably on the dashboard
 * next to other content cards instead of dominating like a hero billboard.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ Competition · Matchday N                       ↗             │
 *   │                                                              │
 *   │   ◯ Home Team               4   :   2          Away Team ◯  │
 *   │                       Final · Race to 5                      │
 *   │                                                              │
 *   │ Today · 7:30 PM · Venue                       [lineup pills] │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Whole card is one anchor; the corner arrow is just an affordance.
 */
export function TodayMatchCard({ match }: { match: TodayMatch }) {
  const isLive = match.status === "IN_PROGRESS";
  const isFinal = match.status === "COMPLETED";
  const isScheduled = match.status === "SCHEDULED";
  const scheduled = match.scheduledAt ? new Date(match.scheduledAt) : null;
  const isToday = scheduled ? isSameDay(scheduled, new Date()) : false;

  const homeName = match.homeTeam?.name ?? "TBD";
  const awayName = match.awayTeam?.name ?? "TBD";
  const homeScore = match.homeScore ?? null;
  const awayScore = match.awayScore ?? null;
  const hasScore = homeScore != null && awayScore != null;
  const raceTo = match.matchday.competition.raceToFrames ?? null;
  const homeWon = isFinal && hasScore && homeScore! > awayScore!;
  const awayWon = isFinal && hasScore && awayScore! > homeScore!;

  return (
    <Link
      href={`/matches/${match.id}`}
      data-testid="today-match-card"
      className="group block rounded-2xl border border-border bg-card transition-colors hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <article className="flex flex-col gap-5 p-5 md:gap-6 md:p-7">
        {/* ── Top: competition context + corner affordance ── */}
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar
              size="sm"
              src={match.matchday.competition.bannerUrl ?? undefined}
              fallback={match.matchday.competition.name}
              shape="competition"
            />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold">
                {match.matchday.competition.name}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Matchday {match.matchday.number}
                {raceTo ? ` · Race to ${raceTo}` : ""}
              </div>
            </div>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
        </header>

        {/* ── Middle: teams + score ── */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
          <TeamCell
            align="left"
            name={homeName}
            logo={match.homeTeam?.logoUrl ?? null}
            winner={homeWon}
            dimmed={awayWon}
          />
          <ScoreCell
            homeScore={homeScore}
            awayScore={awayScore}
            homeWon={homeWon}
            awayWon={awayWon}
            status={match.status}
            isLive={isLive}
            isToday={isToday}
            isScheduled={isScheduled}
            scheduledAt={scheduled}
            raceTo={raceTo}
            isFinal={isFinal}
          />
          <TeamCell
            align="right"
            name={awayName}
            logo={match.awayTeam?.logoUrl ?? null}
            winner={awayWon}
            dimmed={homeWon}
          />
        </div>

        {/* ── Bottom: kickoff / venue / lineup ── */}
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {scheduled ? (
              <KickoffLine
                date={scheduled}
                isToday={isToday}
                isLive={isLive}
                isFinal={isFinal}
              />
            ) : null}
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {match.venue?.name ?? "Venue TBD"}
            </span>
          </div>
          {isScheduled ? (
            <LineupPills
              home={!!match.homeLineupSubmittedAt}
              away={!!match.awayLineupSubmittedAt}
            />
          ) : null}
        </footer>
      </article>
    </Link>
  );
}

/* ---------------------------------------------------------------------- */

function TeamCell({
  name,
  logo,
  align,
  winner,
  dimmed,
}: {
  name: string;
  logo?: string | null;
  align: "left" | "right";
  winner: boolean;
  dimmed: boolean;
}) {
  return (
    <div
      className={
        "flex min-w-0 items-center gap-3 " +
        (align === "right" ? "flex-row-reverse text-right" : "")
      }
    >
      <Avatar
        size="lg"
        src={logo ?? undefined}
        fallback={name}
        shape="team"
        className={
          "shrink-0 " +
          (winner ? "" : dimmed ? "opacity-60" : "")
        }
      />
      <div className="min-w-0">
        <div
          className={
            "truncate text-base font-semibold leading-tight md:text-lg " +
            (dimmed ? "text-muted-foreground" : "text-foreground")
          }
        >
          {name}
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {winner ? "Winner" : align === "left" ? "Home" : "Away"}
        </div>
      </div>
    </div>
  );
}

function ScoreCell({
  homeScore,
  awayScore,
  homeWon,
  awayWon,
  isLive,
  isToday,
  isScheduled,
  isFinal,
  scheduledAt,
  raceTo,
  status,
}: {
  homeScore: number | null;
  awayScore: number | null;
  homeWon: boolean;
  awayWon: boolean;
  isLive: boolean;
  isToday: boolean;
  isScheduled: boolean;
  isFinal: boolean;
  scheduledAt: Date | null;
  raceTo: number | null;
  status: MatchStatus;
}) {
  const hasScore = homeScore != null && awayScore != null;
  return (
    <div className="flex min-w-[88px] flex-col items-center justify-center gap-1.5">
      {hasScore ? (
        <div className="flex items-baseline gap-2 font-mono text-3xl font-semibold leading-none tabular-nums md:text-4xl">
          <span
            className={
              homeWon
                ? "text-foreground"
                : awayWon
                  ? "text-muted-foreground/60"
                  : "text-foreground"
            }
          >
            {homeScore}
          </span>
          <span className="text-base text-muted-foreground/60 md:text-xl">
            :
          </span>
          <span
            className={
              awayWon
                ? "text-foreground"
                : homeWon
                  ? "text-muted-foreground/60"
                  : "text-foreground"
            }
          >
            {awayScore}
          </span>
        </div>
      ) : (
        <div className="font-mono text-3xl font-semibold leading-none tracking-[0.06em] text-muted-foreground/70 md:text-4xl">
          VS
        </div>
      )}
      <StateLine
        status={status}
        isLive={isLive}
        isToday={isToday}
        isScheduled={isScheduled}
        isFinal={isFinal}
        scheduledAt={scheduledAt}
        hasScore={hasScore}
        raceTo={raceTo}
      />
    </div>
  );
}

function StateLine({
  isLive,
  isFinal,
  isToday,
  isScheduled,
  scheduledAt,
  hasScore,
  raceTo,
}: {
  status: MatchStatus;
  isLive: boolean;
  isFinal: boolean;
  isToday: boolean;
  isScheduled: boolean;
  scheduledAt: Date | null;
  hasScore: boolean;
  raceTo: number | null;
}) {
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-destructive">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-destructive" />
        Live
        {raceTo ? <span className="text-muted-foreground"> · Race to {raceTo}</span> : null}
      </span>
    );
  }
  if (isFinal) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-success">
        Final
        {raceTo ? <span className="text-muted-foreground"> · Race to {raceTo}</span> : null}
      </span>
    );
  }
  if (isToday && isScheduled && scheduledAt && !hasScore) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
        <Countdown to={scheduledAt} />
      </span>
    );
  }
  if (raceTo) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        Race to {raceTo}
      </span>
    );
  }
  return null;
}

function KickoffLine({
  date,
  isToday,
  isLive,
  isFinal,
}: {
  date: Date;
  isToday: boolean;
  isLive: boolean;
  isFinal: boolean;
}) {
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (isFinal) {
    const day = date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return <span>{`${day} · ${time}`}</span>;
  }
  if (isLive) {
    return <span className="text-destructive">Started {time}</span>;
  }
  if (isToday) {
    return <span className="text-primary">Today · {time}</span>;
  }
  const day = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return <span>{`${day} · ${time}`}</span>;
}

function LineupPills({ home, away }: { home: boolean; away: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
      <span
        className={
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 " +
          (home ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground")
        }
        title={home ? "Home lineup submitted" : "Home lineup pending"}
      >
        H · {home ? "set" : "—"}
      </span>
      <span
        className={
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 " +
          (away ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground")
        }
        title={away ? "Away lineup submitted" : "Away lineup pending"}
      >
        A · {away ? "set" : "—"}
      </span>
    </span>
  );
}

function Countdown({ to }: { to: Date | null }) {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    if (!to) return;
    const render = () => {
      const ms = to.getTime() - Date.now();
      if (ms <= 0) {
        setText("Starting");
        return;
      }
      const totalMinutes = Math.round(ms / 60_000);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      setText(h > 0 ? `In ${h}h ${m}m` : `In ${m}m`);
    };
    render();
    const interval = setInterval(render, 60_000);
    return () => clearInterval(interval);
  }, [to]);
  return <span>{text || "Today"}</span>;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
