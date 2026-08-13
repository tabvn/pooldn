import Link from "next/link";
import { Calendar, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { competitionStatusLabel } from "@/components/ui/status-chip";
import type {
  CompetitionFormat,
  CompetitionStatus,
  GameType,
} from "@/lib/generated/prisma/enums";

const NUM = new Intl.NumberFormat("en-US");

const GAME_SHORT: Record<string, string> = {
  EIGHT_BALL: "8-ball",
  NINE_BALL: "9-ball",
  TEN_BALL: "10-ball",
  STRAIGHT_POOL: "Straight pool",
};

const FORMAT_SHORT: Record<string, string> = {
  ROUND_ROBIN: "Round Robin / League",
  SINGLE_ELIMINATION: "Single Elimination",
  DOUBLE_ELIMINATION: "Double Elimination",
  SWISS: "Swiss",
};

export type CompetitionRowCardData = {
  id: string;
  slug: string;
  name: string;
  status: CompetitionStatus;
  format: CompetitionFormat;
  gameType: GameType;
  type?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  prizePool?: string | null;
  currency?: string | null;
  minTeams?: number | null;
  maxTeams?: number | null;
  bannerUrl?: string | null;
};

/**
 * Round-52 — Figma dashboard row card.
 *
 * One-row horizontal card with: title + small Teams/format/game line,
 * date / team-count / prize meta strip, and a single colour-coded
 * status pill in the top-right. Restrained palette — no decorative
 * banner gradient, no per-meta colour chips — so the dashboard reads
 * calmly even when many comps are listed at once.
 *
 * `accent` lets the caller tone-up Active rows with a subtle border
 * tint (the Figma's teal wash); leave it as "muted" for everything else.
 */
export function CompetitionRowCard({
  c,
  accent = "muted",
}: {
  c: CompetitionRowCardData;
  accent?: "muted" | "active";
}) {
  const isActive = accent === "active";
  return (
    <Link
      href={`/competitions/${c.slug}`}
      data-testid={`competition-row-${c.slug}`}
      className={cn(
        "block rounded-xl border px-4 py-4 transition-colors",
        isActive
          ? "border-teal-900/60 bg-teal-950/40 hover:border-teal-700/80"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate text-base font-semibold text-foreground">
            {c.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {c.type === "TEAMS" ? (
              <TypeBadge tone="teams">Teams</TypeBadge>
            ) : c.type === "INDIVIDUAL" ? (
              <TypeBadge tone="singles">Singles</TypeBadge>
            ) : c.type === "DOUBLES" ? (
              <TypeBadge tone="doubles">Doubles</TypeBadge>
            ) : null}
            <span>{FORMAT_SHORT[c.format] ?? c.format}</span>
            <span aria-hidden>·</span>
            <span>{GAME_SHORT[c.gameType] ?? c.gameType}</span>
          </div>
        </div>
        <StatusPill status={c.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        {c.startDate ? (
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            Starts{" "}
            <LocalDateTime value={c.startDate} variant="date" />
          </span>
        ) : null}
        {c.minTeams != null ? (
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" />
            {c.minTeams}
            {c.maxTeams ? `/${c.maxTeams}` : "+"}
          </span>
        ) : null}
        {c.prizePool ? (
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="size-3.5" />
            {NUM.format(Number(c.prizePool))} {c.currency ?? ""}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function TypeBadge({
  children,
  tone = "teams",
}: {
  children: React.ReactNode;
  tone?: "teams" | "singles" | "doubles";
}) {
  // Teams keeps the brand lime; Singles/Doubles get their own colour so the
  // format is distinguishable at a glance.
  const cls =
    tone === "singles"
      ? "bg-violet-600 text-white"
      : tone === "doubles"
        ? "bg-sky-500 text-white"
        : "bg-primary text-primary-foreground";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: CompetitionStatus }) {
  const label =
    status === "OPEN_FOR_APPLICATIONS"
      ? "Upcoming"
      : status === "ONGOING"
        ? "Active"
        : (competitionStatusLabel[status] ?? status);
  const tone: "lime" | "teal" | "muted" =
    status === "OPEN_FOR_APPLICATIONS"
      ? "lime"
      : status === "ONGOING"
        ? "teal"
        : "muted";
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        tone === "lime" && "bg-primary text-primary-foreground",
        tone === "teal" && "bg-teal-700 text-white",
        tone === "muted" && "bg-secondary text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
