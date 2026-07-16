import { Calendar, Trophy, Users } from "lucide-react";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { competitionStatusLabel } from "@/components/ui/status-chip";
import type {
  CompetitionFormat,
  CompetitionStatus,
  CompetitionType,
  GameType,
} from "@/lib/generated/prisma/enums";

const NUM = new Intl.NumberFormat("en-US");

const GAME_LABEL: Record<string, string> = {
  EIGHT_BALL: "8-ball",
  NINE_BALL: "9-ball",
  TEN_BALL: "10-ball",
  STRAIGHT_POOL: "Straight pool",
};

const FORMAT_LABEL: Record<string, string> = {
  ROUND_ROBIN: "Round Robin / League",
  SINGLE_ELIMINATION: "Single Elimination",
  DOUBLE_ELIMINATION: "Double Elimination",
  SWISS: "Swiss",
};

const TYPE_LABEL: Record<string, string> = {
  TEAMS: "Teams",
  INDIVIDUAL: "Singles",
  DOUBLES: "Doubles",
};

// Status pill tone — pink for DRAFT (matches Figma), lime for the live
// "accepting" state, muted for the rest.
function StatusPill({ status }: { status: CompetitionStatus }) {
  const label =
    status === "OPEN_FOR_APPLICATIONS"
      ? "Accepting Teams"
      : (competitionStatusLabel[status] ?? status);
  const cls =
    status === "DRAFT"
      ? "bg-pink-600 text-white"
      : status === "OPEN_FOR_APPLICATIONS"
        ? "bg-primary text-primary-foreground"
        : status === "ONGOING"
          ? "bg-teal-700 text-white"
          : "bg-secondary text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

/**
 * Round-60 — Figma "Competition Page Title" hero (node 299:9506 + the
 * draft editor's own hero). A lime-tinted full-bleed band: name in lime,
 * status + type badges, format · game line, and an icon meta row (start
 * date / confirmed teams / prize). `actions` is rendered flush-right
 * (Follow + Apply/Manage). Inner content shares the max-w-5xl shell used
 * across the app so the detail screens line up with the rest.
 */
export function CompetitionHero({
  competition: c,
  actions,
}: {
  competition: {
    name: string;
    status: CompetitionStatus;
    type: CompetitionType;
    format: CompetitionFormat;
    gameType: GameType;
    startDate?: string | null;
    prizePool?: string | null;
    currency?: string | null;
    approvedTeamCount?: number | null;
    maxTeams?: number | null;
  };
  actions?: React.ReactNode;
}) {
  const teamWord = c.type === "INDIVIDUAL" ? "players" : "teams";
  return (
    <header className="bg-primary/10">
      {/* Padding lives INSIDE the max-w-5xl wrapper so the hero content
          aligns to the same grid as the tabs + content below (also
          max-w-5xl px-4 md:px-10). The lime band still bleeds full-width. */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-start justify-between gap-4 px-4 py-5 md:px-10 md:py-10">
        <div className="min-w-0 space-y-3">
          <h1 className="text-xl font-semibold text-primary md:text-3xl">
            {c.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusPill status={c.status} />
            <span className="inline-flex items-center rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              {TYPE_LABEL[c.type] ?? c.type}
            </span>
            <span>{FORMAT_LABEL[c.format] ?? c.format}</span>
            <span aria-hidden>·</span>
            <span>{GAME_LABEL[c.gameType] ?? c.gameType}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
            {c.startDate ? (
              <span className="inline-flex items-center gap-1.5 text-primary">
                <Calendar className="size-4" />
                Starts <LocalDateTime value={c.startDate} variant="date" />
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Users className="size-4" />
              {c.approvedTeamCount ?? 0}
              {c.maxTeams ? `/${c.maxTeams}` : ""} {teamWord}
            </span>
            {c.prizePool ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Trophy className="size-4" />
                {NUM.format(Number(c.prizePool))} {c.currency ?? ""}
              </span>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
