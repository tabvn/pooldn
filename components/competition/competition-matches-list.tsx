"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CalendarOff, ChevronDown, MapPin, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import { SetMatchDateButton } from "./set-match-date-button";

/**
 * Round-92 — the Free Schedule view: a competition with fixtures but no calendar.
 *
 * Weekly Rounds and Fixed Dates group matches into numbered matchdays, which is
 * what components/competition/matchday-list.tsx renders. This mode has no rounds
 * at all — every pairing exists from day one with no date — so the whole season
 * is one list, split by what has actually happened:
 *
 *   Played        ← results, most recent first
 *   ───── now ─────  the "Go to current" anchor
 *   Scheduled     ← dated fixtures, soonest first
 *   No date yet   ← the rest, in fixture order
 *
 * Filtering narrows rows WITHIN those sections rather than flattening them, so
 * "show me Minh's games" still reads as results-then-fixtures.
 */

type Side = {
  id: string;
  name: string;
  slug?: string | null;
  username?: string | null;
  logoUrl?: string | null;
  avatarUrl?: string | null;
  isShell?: boolean | null;
} | null;

export type CompetitionMatch = {
  id: string;
  status: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  matchday: { id: string; number: number };
  venue?: { id: string; name: string } | null;
  homeTeam: Side;
  awayTeam: Side;
  homePlayer: Side;
  awayPlayer: Side;
};

/** Team-or-player, normalised — same idea as profile/match-history.tsx. */
function sideOf(team: Side, player: Side) {
  const s = team ?? player;
  return {
    name: s?.name ?? "TBD",
    logo: s?.logoUrl ?? s?.avatarUrl ?? null,
    ghost: !!s?.isShell,
    isTeam: !!team,
    searchable: [s?.name, s?.slug, s?.username]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

function isPlayed(m: CompetitionMatch): boolean {
  if (m.status === "COMPLETED" || m.status === "CANCELLED") return true;
  // A bye — one side missing — is resolved the moment it exists.
  const bothSides =
    (m.homeTeam ?? m.homePlayer) && (m.awayTeam ?? m.awayPlayer);
  return !bothSides;
}

function MatchRow({
  m,
  canManage,
}: {
  m: CompetitionMatch;
  canManage: boolean;
}) {
  const home = sideOf(m.homeTeam, m.homePlayer);
  const away = sideOf(m.awayTeam, m.awayPlayer);
  // Status beats stale numbers: a reopened match can still carry its old score.
  const decided =
    m.homeScore != null &&
    m.awayScore != null &&
    m.status !== "SCHEDULED" &&
    m.status !== "POSTPONED";
  const homeWon = decided ? (m.homeScore ?? 0) > (m.awayScore ?? 0) : false;
  const awayWon = decided ? (m.awayScore ?? 0) > (m.homeScore ?? 0) : false;

  return (
    <div
      data-testid={`competition-match-${m.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:border-primary/40"
    >
      {/* The row is NOT one big anchor: the manager's date control lives beside
          it, and a button inside an anchor is invalid and swallows the click. */}
      <Link
        href={`/matches/${m.id}`}
        className="flex min-w-0 flex-1 flex-col gap-1"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Avatar
            size="xs"
            src={home.logo ?? undefined}
            fallback={home.name}
            shape={home.isTeam ? "team" : "user"}
            ghost={home.ghost}
          />
          <span
            className={cn(
              "truncate text-sm",
              homeWon ? "font-semibold" : "text-muted-foreground",
            )}
          >
            {home.name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">vs</span>
          <Avatar
            size="xs"
            src={away.logo ?? undefined}
            fallback={away.name}
            shape={away.isTeam ? "team" : "user"}
            ghost={away.ghost}
          />
          <span
            className={cn(
              "truncate text-sm",
              awayWon ? "font-semibold" : "text-muted-foreground",
            )}
          >
            {away.name}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {m.scheduledAt ? (
            <LocalDateTime value={m.scheduledAt} variant="datetime" />
          ) : (
            <span className="italic">Date to be agreed</span>
          )}
          {m.venue ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{m.venue.name}</span>
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        {decided ? (
          <span className="font-mono text-sm font-bold tabular-nums">
            {m.homeScore}–{m.awayScore}
          </span>
        ) : m.status === "IN_PROGRESS" ? (
          <Badge variant="primary" size="sm">
            Live
          </Badge>
        ) : null}
        {canManage && m.status !== "COMPLETED" ? (
          <SetMatchDateButton
            matchId={m.id}
            scheduledAt={m.scheduledAt ?? null}
          />
        ) : null}
      </div>
    </div>
  );
}

const PREVIEW = 8;

function Section({
  testId,
  title,
  icon,
  items,
  canManage,
  defaultExpanded = false,
}: {
  testId: string;
  title: string;
  icon: React.ReactNode;
  items: CompetitionMatch[];
  canManage: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  if (items.length === 0) return null;
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
      {shown.map((m) => (
        <MatchRow key={m.id} m={m} canManage={canManage} />
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

export function CompetitionMatchesList({
  matches,
  canManage,
  isIndividual,
}: {
  matches: CompetitionMatch[];
  canManage: boolean;
  isIndividual: boolean;
}) {
  const [q, setQ] = useState("");

  const { played, scheduled, undated, total } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? matches.filter((m) => {
          const home = sideOf(m.homeTeam, m.homePlayer);
          const away = sideOf(m.awayTeam, m.awayPlayer);
          return (
            home.searchable.includes(needle) || away.searchable.includes(needle)
          );
        })
      : matches;

    const time = (v?: string | null) => (v ? new Date(v).getTime() : 0);
    const playedRows = filtered
      .filter(isPlayed)
      .sort(
        (a, b) =>
          time(b.completedAt ?? b.scheduledAt) -
          time(a.completedAt ?? a.scheduledAt),
      );
    const rest = filtered.filter((m) => !isPlayed(m));
    const scheduledRows = rest
      .filter((m) => m.scheduledAt)
      .sort((a, b) => {
        // Anything live belongs at the top of what's coming.
        if (a.status !== b.status) {
          if (a.status === "IN_PROGRESS") return -1;
          if (b.status === "IN_PROGRESS") return 1;
        }
        return time(a.scheduledAt) - time(b.scheduledAt);
      });
    const undatedRows = rest
      .filter((m) => !m.scheduledAt)
      .sort((a, b) => a.matchday.number - b.matchday.number);

    return {
      played: playedRows,
      scheduled: scheduledRows,
      undated: undatedRows,
      total: filtered.length,
    };
  }, [matches, q]);

  const goToCurrent = () =>
    document
      .querySelector("[data-current]")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="space-y-4" data-testid="competition-matches-list">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={
              isIndividual ? "Search players…" : "Search teams…"
            }
            testId="matches-search"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {total} {total === 1 ? "match" : "matches"}
          {q.trim() ? ` matching “${q.trim()}”` : ""}
        </span>
        {played.length > 0 && scheduled.length + undated.length > 0 ? (
          <button
            type="button"
            onClick={goToCurrent}
            data-testid="matches-go-to-current"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Go to current
          </button>
        ) : null}
      </div>

      {total === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {q.trim()
            ? `No matches for “${q.trim()}”.`
            : "No fixtures yet."}
        </p>
      ) : null}

      <Section
        testId="matches-played"
        title="Played"
        icon={<Trophy className="size-3.5" />}
        items={played}
        canManage={canManage}
      />

      {played.length > 0 && scheduled.length + undated.length > 0 ? (
        // The divider IS the "current" anchor the toolbar scrolls to.
        <div
          data-current
          data-testid="matches-current-line"
          className="flex items-center gap-3 py-1"
          aria-label="Everything below is still to play"
        >
          <span className="h-px flex-1 bg-primary/40" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Up next
          </span>
          <span className="h-px flex-1 bg-primary/40" />
        </div>
      ) : null}

      <Section
        testId="matches-scheduled"
        title="Scheduled"
        icon={<CalendarDays className="size-3.5" />}
        items={scheduled}
        canManage={canManage}
        defaultExpanded
      />

      <Section
        testId="matches-undated"
        title="No date yet"
        icon={<CalendarOff className="size-3.5" />}
        items={undated}
        canManage={canManage}
      />
    </div>
  );
}
