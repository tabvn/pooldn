"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { MoveMatchdayButton } from "@/components/competition/move-matchday-button";
import type { MatchStatus } from "@/lib/generated/prisma/enums";

type TeamRef = {
  name: string;
  slug: string;
  logoUrl?: string | null;
} | null;

export type MatchView = {
  id: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  home: TeamRef;
  away: TeamRef;
  venueName: string | null;
};

export type MatchdayView = {
  id: string;
  number: number;
  label: string | null;
  /** Organizer note when the matchday was moved (holiday, clash, …). */
  note: string | null;
  scheduledDate: string | null;
  state: "past" | "current" | "scheduled";
  matches: MatchView[];
  /** Teams sitting out this matchday (odd team count → one bye per round). */
  byes: NonNullable<TeamRef>[];
};

// Figma "Team Match Card" — center column status badge.
const STATUS_BADGE: Record<MatchStatus, { label: string; className: string }> = {
  COMPLETED: { label: "Complete", className: "bg-[#00968933] text-[#46ecd5]" },
  IN_PROGRESS: { label: "In Progress", className: "bg-primary/20 text-primary" },
  SCHEDULED: { label: "Scheduled", className: "bg-[#0084d133] text-[#74d4ff]" },
  POSTPONED: { label: "Postponed", className: "bg-warning/15 text-warning" },
  CANCELLED: { label: "Cancelled", className: "bg-destructive/15 text-destructive" },
};

const MD_LABEL_TONE: Record<MatchdayView["state"], string> = {
  current: "text-[#00bba7]",
  scheduled: "text-[#00a6f4]",
  past: "text-white/50",
};

const MD_BADGE: Record<MatchdayView["state"], { label: string; className: string }> = {
  current: { label: "Current", className: "bg-[#00968933] text-[#46ecd5]" },
  scheduled: { label: "Scheduled", className: "bg-[#0084d133] text-[#74d4ff]" },
  past: { label: "Past", className: "bg-white/20 text-white/90" },
};

function isBye(m: MatchView) {
  return !m.home || !m.away;
}

/** One 32px score box. Tone depends on win/lose/draw for completed matches. */
function ScoreBox({
  value,
  tone,
}: {
  value: number | null;
  tone: "win" | "lose" | "draw" | "muted";
}) {
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

// No inner team link — the whole match card links to the match details
// screen, so nested team links only crowded the card and hijacked the click.
function Participant({ team }: { team: TeamRef }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <Avatar
        size="sm"
        src={team?.logoUrl ?? undefined}
        fallback={team?.name ?? "TBD"}
        shape="team"
        className="size-8"
      />
      <span className="min-w-full text-center text-sm text-white/90">
        {team?.name ?? "TBD"}
      </span>
    </div>
  );
}

// Figma "Variant5" bye card: single team + "Bye" badge, no border / footer.
function ByeCard({ team }: { team: { name: string; slug: string; logoUrl?: string | null } }) {
  return (
    <div
      className="flex w-full items-center gap-4 rounded-lg bg-[#22292b] p-4"
      data-testid="matchday-bye"
    >
      <Avatar
        size="sm"
        src={team.logoUrl ?? undefined}
        fallback={team.name}
        shape="team"
        className="size-8"
      />
      <span className="flex-1 text-sm text-white/90">{team.name}</span>
      <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs font-semibold text-white/90">
        Bye
      </span>
    </div>
  );
}

function MatchCard({ m }: { m: MatchView }) {
  // A one-sided match row (walkover / TBD) also renders as a bye card.
  if (isBye(m)) {
    const team = m.home ?? m.away;
    return (
      <div className="flex w-full items-center gap-4 rounded-lg bg-[#22292b] p-4">
        <Avatar
          size="sm"
          src={team?.logoUrl ?? undefined}
          fallback={team?.name ?? "TBD"}
          shape="team"
          className="size-8"
        />
        <span className="flex-1 text-sm text-white/90">{team?.name ?? "TBD"}</span>
        <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs font-semibold text-white/90">
          Bye
        </span>
      </div>
    );
  }

  const badge = STATUS_BADGE[m.status];
  const completed = m.status === "COMPLETED";
  const hs = m.homeScore;
  const as = m.awayScore;
  let homeTone: "win" | "lose" | "draw" | "muted" = "muted";
  let awayTone: "win" | "lose" | "draw" | "muted" = "muted";
  if (completed && hs != null && as != null) {
    if (hs === as) {
      homeTone = awayTone = "draw";
    } else {
      homeTone = hs > as ? "win" : "lose";
      awayTone = as > hs ? "win" : "lose";
    }
  }

  return (
    <Link
      href={`/matches/${m.id}`}
      className={`flex w-full flex-col overflow-hidden rounded-lg border bg-[#22292b] transition-colors hover:border-primary/50 ${
        m.status === "IN_PROGRESS" ? "border-[#46ecd5]" : "border-border"
      }`}
    >
      <div className="flex items-center gap-4 p-4">
        <Participant team={m.home} />
        <div className="flex shrink-0 flex-col items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
          <div className="flex items-center gap-1">
            <ScoreBox value={hs} tone={homeTone} />
            <span className="w-5 text-center text-sm text-white/50">:</span>
            <ScoreBox value={as} tone={awayTone} />
          </div>
        </div>
        <Participant team={m.away} />
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-dashed border-border px-4 py-3">
        <MapPin className="size-3 text-white/50" />
        <span className="text-xs text-white/50">{m.venueName ?? "Venue TBD"}</span>
      </div>
    </Link>
  );
}

function MatchdaySection({
  md,
  canManage,
}: {
  md: MatchdayView;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(true);
  const badge = MD_BADGE[md.state];
  const isCurrent = md.state === "current";
  // Organizers can move any not-yet-finished matchday.
  const canMove = canManage && md.state !== "past";

  return (
    <section
      id={`matchday-${md.number}`}
      data-current={isCurrent || undefined}
      className={
        isCurrent
          ? "rounded-xl bg-[#00968919] px-4 py-3 md:px-6"
          : "px-0 py-1"
      }
    >
      <div className="mx-auto w-full max-w-[640px]">
        {/* Matchday header */}
        <div className="flex items-center gap-4 border-b border-border py-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span
              className={`text-xs font-semibold uppercase tracking-[0.6px] ${MD_LABEL_TONE[md.state]}`}
            >
              Matchday {md.number}
              {md.label && md.label.trim() !== `Matchday ${md.number}`
                ? ` — ${md.label}`
                : ""}
            </span>
            <span className="text-sm text-white/90">
              {md.scheduledDate ? (
                <LocalDateTime value={md.scheduledDate} variant="weekday" />
              ) : (
                "Date TBD"
              )}
            </span>
            {md.note ? (
              <span
                className="mt-0.5 text-xs text-warning"
                data-testid={`matchday-note-${md.number}`}
              >
                Moved · {md.note}
              </span>
            ) : null}
          </div>
          {canMove ? (
            <MoveMatchdayButton
              matchdayId={md.id}
              number={md.number}
              scheduledDate={md.scheduledDate}
            />
          ) : null}
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Collapse matchday" : "Expand matchday"}
            aria-expanded={open}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20"
          >
            <ChevronDown
              className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`}
            />
          </button>
        </div>

        {open ? (
          <div className="flex flex-col gap-2 pt-2">
            {md.matches.length === 0 && md.byes.length === 0 ? (
              <p className="py-4 text-center text-sm text-white/50">
                No matches scheduled.
              </p>
            ) : (
              <>
                {md.matches.map((m) => (
                  <MatchCard key={m.id} m={m} />
                ))}
                {md.byes.map((t) => (
                  <ByeCard key={`bye-${t.slug}`} team={t} />
                ))}
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function MatchdayList({
  matchdays,
  canManage = false,
}: {
  matchdays: MatchdayView[];
  canManage?: boolean;
}) {
  const topRef = useRef<HTMLDivElement>(null);
  const hasCurrent = matchdays.some((md) => md.state === "current");

  const scrollTo = (selector: string) => {
    const el = document.querySelector(selector);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={topRef} className="space-y-4">
      {/* Go to Top / Go to Current controls (node 403:15247) */}
      <div className="sticky top-2 z-10 flex justify-center gap-2 rounded-lg border border-border bg-card/80 px-6 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => topRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="rounded-md border border-primary/50 px-2 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          Go to Top
        </button>
        {hasCurrent ? (
          <button
            type="button"
            onClick={() => scrollTo("[data-current]")}
            className="rounded-md border border-primary/50 px-2 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            Go to Current
          </button>
        ) : null}
      </div>

      {matchdays.map((md) => (
        <MatchdaySection key={md.id} md={md} canManage={canManage} />
      ))}
    </div>
  );
}
