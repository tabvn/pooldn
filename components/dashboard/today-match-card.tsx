"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
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
    };
  };
};

// Same status pills as the regular game cards (matchday list).
const STATUS_BADGE: Partial<
  Record<MatchStatus, { label: string; className: string }>
> = {
  COMPLETED: { label: "Complete", className: "bg-[#00968933] text-[#46ecd5]" },
  IN_PROGRESS: { label: "In Progress", className: "bg-primary/20 text-primary" },
  SCHEDULED: { label: "Scheduled", className: "bg-[#0084d133] text-[#74d4ff]" },
  POSTPONED: { label: "Postponed", className: "bg-warning/15 text-warning" },
  CANCELLED: { label: "Cancelled", className: "bg-destructive/15 text-destructive" },
};

type Tone = "win" | "lose" | "draw" | "muted";

/**
 * Round-68 — the dashboard's upcoming/active match card now uses the same
 * "Team Match Card" visual as the matchday list (team sides + status pill +
 * teal/pink score boxes + venue footer). No "Race to" — that 1v1 concept was
 * removed from team matches.
 */
export function TodayMatchCard({ match }: { match: TodayMatch }) {
  const isLive = match.status === "IN_PROGRESS";
  const isFinal = match.status === "COMPLETED";
  const hs = match.homeScore ?? null;
  const as = match.awayScore ?? null;
  const decided = isFinal && hs != null && as != null;
  const homeWon = decided && hs! > as!;
  const awayWon = decided && as! > hs!;
  const draw = decided && hs! === as!;

  const homeTone: Tone = draw ? "draw" : homeWon ? "win" : awayWon ? "lose" : "muted";
  const awayTone: Tone = draw ? "draw" : awayWon ? "win" : homeWon ? "lose" : "muted";

  const badge = STATUS_BADGE[match.status];
  const kickoff = kickoffLabel(match.scheduledAt, isLive, isFinal);

  return (
    <Link
      href={`/matches/${match.id}`}
      data-testid="today-match-card"
      className={`block overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/50 ${
        isLive ? "border-[#46ecd5]" : "border-border"
      }`}
    >
      {/* Competition context */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
        <Avatar
          size="xs"
          src={match.matchday.competition.bannerUrl ?? undefined}
          fallback={match.matchday.competition.name}
          shape="competition"
        />
        <span className="truncate">
          {match.matchday.competition.name} · Matchday {match.matchday.number}
        </span>
        {kickoff ? <span className="ml-auto shrink-0">{kickoff}</span> : null}
      </div>

      {/* Teams + score */}
      <div className="flex items-center gap-4 p-4">
        <TeamSide
          name={match.homeTeam?.name}
          logoUrl={match.homeTeam?.logoUrl}
          won={homeWon}
          lost={awayWon}
        />
        <div className="flex shrink-0 flex-col items-center gap-2">
          {badge ? (
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-semibold ${badge.className}`}
            >
              {badge.label}
            </span>
          ) : null}
          <div className="flex items-center gap-1">
            <ScoreBox value={hs} tone={homeTone} />
            <span className="w-5 text-center text-sm text-muted-foreground">:</span>
            <ScoreBox value={as} tone={awayTone} />
          </div>
        </div>
        <TeamSide
          name={match.awayTeam?.name}
          logoUrl={match.awayTeam?.logoUrl}
          won={awayWon}
          lost={homeWon}
          align="right"
        />
      </div>

      {/* Venue footer */}
      <div className="flex items-center justify-center gap-2 border-t border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
        <MapPin className="size-3" />
        {match.venue?.name ?? "Venue TBD"}
      </div>
    </Link>
  );
}

function TeamSide({
  name,
  logoUrl,
  won,
  lost,
  align = "left",
}: {
  name?: string | null;
  logoUrl?: string | null;
  won: boolean;
  lost: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center gap-2 ${lost ? "opacity-70" : ""}`}>
      <Avatar size="md" src={logoUrl ?? undefined} fallback={name ?? "TBD"} shape="team" />
      <span className="min-w-full text-center text-sm font-medium text-white/90">
        {name ?? "TBD"}
      </span>
      {won ? (
        <span className="rounded bg-[#005f5a] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#96f7e4]">
          Winner
        </span>
      ) : null}
      <span className="sr-only">{align === "right" ? "Away" : "Home"}</span>
    </div>
  );
}

function ScoreBox({ value, tone }: { value: number | null; tone: Tone }) {
  const cls =
    tone === "win"
      ? "bg-[#005f5a] text-[#96f7e4]"
      : tone === "lose"
        ? "bg-[#861043] text-[#fccee8]"
        : tone === "draw"
          ? "bg-white/10 text-white/90"
          : "bg-white/5 text-white/50";
  return (
    <div
      className={`flex size-8 items-center justify-center rounded text-base font-semibold tabular-nums ${cls}`}
    >
      {value ?? 0}
    </div>
  );
}

function kickoffLabel(
  scheduledAt: string | null | undefined,
  isLive: boolean,
  isFinal: boolean,
): string | null {
  if (!scheduledAt) return null;
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const today = isSameDay(d, new Date());
  if (isLive) return `Started ${time}`;
  if (isFinal || !today) {
    const day = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return `${day} · ${time}`;
  }
  return `Today · ${time}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
