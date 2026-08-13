import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";

/**
 * Round-67 — single-elimination bracket tree.
 *
 * Lays the rounds out as columns with a deterministic geometry: round-1 cards
 * are evenly spaced, and every later card sits at the vertical midpoint of the
 * two feeders it drains, so the tree lines up perfectly without measuring the
 * DOM. SVG elbows connect each pair to its next match. Horizontally scrollable
 * on narrow screens.
 */

type Team = { id: string; name: string; slug: string; logoUrl?: string | null };
type Player = { id: string; name: string; username: string; avatarUrl?: string | null };

export type BracketMatch = {
  id: string;
  bracketRound?: number | null;
  bracketPosition?: number | null;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  winType?: string | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  homePlayer?: Player | null;
  awayPlayer?: Player | null;
};

// A bracket side is a team or a player; normalise to a common shape.
type Participant = {
  name: string;
  href: string;
  image?: string | null;
  team: boolean;
};
function toParticipant(team?: Team | null, player?: Player | null): Participant | null {
  if (player)
    return {
      name: player.name,
      href: `/players/${player.username}`,
      image: player.avatarUrl,
      team: false,
    };
  if (team)
    return {
      name: team.name,
      href: `/teams/${team.slug}`,
      image: team.logoUrl,
      team: true,
    };
  return null;
}

const CARD_W = 208;
const CARD_H = 60;
const V_GAP = 20;
const COL_GAP = 56;
const UNIT = CARD_H + V_GAP;

function roundLabel(round: number, maxRound: number): string {
  const teams = 1 << (maxRound - round + 1);
  if (teams === 2) return "Final";
  if (teams === 4) return "Semifinals";
  if (teams === 8) return "Quarterfinals";
  return `Round of ${teams}`;
}

export function BracketTree({ matches }: { matches: BracketMatch[] }) {
  const rounds = [...new Set(matches.map((m) => m.bracketRound ?? 1))].sort(
    (a, b) => a - b,
  );
  if (rounds.length === 0) return null;
  const maxRound = rounds[rounds.length - 1]!;
  const byRound = new Map<number, BracketMatch[]>();
  for (const r of rounds) {
    byRound.set(
      r,
      matches
        .filter((m) => (m.bracketRound ?? 1) === r)
        .sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0)),
    );
  }

  // Vertical center of each match, per round (round 1 evenly spaced; later
  // rounds average their two feeders).
  const centers = new Map<number, number[]>();
  const r1 = byRound.get(rounds[0]!)!;
  centers.set(
    rounds[0]!,
    r1.map((_, i) => i * UNIT + CARD_H / 2),
  );
  for (let ri = 1; ri < rounds.length; ri++) {
    const r = rounds[ri]!;
    const prev = centers.get(rounds[ri - 1]!)!;
    const here = byRound.get(r)!.map((_, p) => {
      const a = prev[2 * p] ?? p * UNIT + CARD_H / 2;
      const b = prev[2 * p + 1] ?? a;
      return (a + b) / 2;
    });
    centers.set(r, here);
  }

  const xOf = (roundIdx: number) => roundIdx * (CARD_W + COL_GAP);
  const width = rounds.length * CARD_W + (rounds.length - 1) * COL_GAP;
  const height = r1.length * UNIT;

  return (
    <div className="overflow-x-auto p-4">
      <div style={{ width }} className="relative">
        {/* Round headers */}
        <div className="relative mb-2" style={{ height: 20 }}>
          {rounds.map((r, ri) => (
            <div
              key={r}
              className="absolute text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ left: xOf(ri), width: CARD_W }}
            >
              {roundLabel(r, maxRound)}
            </div>
          ))}
        </div>

        {/* Tree */}
        <div className="relative" style={{ width, height }}>
          <svg
            className="pointer-events-none absolute inset-0"
            width={width}
            height={height}
          >
            {rounds.slice(1).map((r, i) => {
              const ri = i + 1;
              const prev = centers.get(rounds[ri - 1]!)!;
              const here = centers.get(r)!;
              const feederRight = xOf(ri - 1) + CARD_W;
              const midX = feederRight + COL_GAP / 2;
              const cardLeft = xOf(ri);
              return here.map((cy, p) => {
                const a = prev[2 * p];
                const b = prev[2 * p + 1] ?? a;
                return (
                  <g key={`${r}-${p}`} stroke="currentColor" className="text-border" strokeWidth={1.5} fill="none">
                    {a != null ? <path d={`M${feederRight},${a} H${midX}`} /> : null}
                    {b != null ? <path d={`M${feederRight},${b} H${midX}`} /> : null}
                    {a != null && b != null ? <path d={`M${midX},${a} V${b}`} /> : null}
                    <path d={`M${midX},${cy} H${cardLeft}`} />
                  </g>
                );
              });
            })}
          </svg>

          {rounds.map((r, ri) =>
            byRound.get(r)!.map((m, p) => (
              <MatchCard
                key={m.id}
                m={m}
                style={{
                  position: "absolute",
                  left: xOf(ri),
                  top: (centers.get(r)![p] ?? 0) - CARD_H / 2,
                  width: CARD_W,
                  height: CARD_H,
                }}
              />
            )),
          )}
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  m,
  style,
}: {
  m: BracketMatch;
  style: React.CSSProperties;
}) {
  const completed = m.status === "COMPLETED";
  const hs = m.homeScore ?? null;
  const as = m.awayScore ?? null;
  const home = toParticipant(m.homeTeam, m.homePlayer);
  const away = toParticipant(m.awayTeam, m.awayPlayer);
  // Winner: by score, or a bye (only one side on a completed match).
  const homeWon =
    completed && (away == null || (hs != null && as != null && hs > as));
  const awayWon =
    completed && home != null && hs != null && as != null && as > hs;

  return (
    <Link
      href={`/matches/${m.id}`}
      style={style}
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-xs hover:border-primary/50"
      data-testid={`bracket-match-${m.bracketRound}-${m.bracketPosition}`}
    >
      <Side p={home} score={hs} won={homeWon} placeholder="TBD" />
      <div className="h-px bg-border" />
      <Side
        p={away}
        score={as}
        won={awayWon}
        placeholder={completed && home ? "BYE" : "TBD"}
      />
    </Link>
  );
}

function Side({
  p,
  score,
  won,
  placeholder,
}: {
  p: Participant | null;
  score: number | null;
  won: boolean;
  placeholder: string;
}) {
  return (
    <div
      className={`flex flex-1 items-center gap-2 px-2 ${
        won ? "bg-primary/10" : ""
      }`}
    >
      {p ? (
        <Avatar
          size="sm"
          src={p.image ?? undefined}
          fallback={p.name}
          shape={p.team ? "team" : "user"}
          className="size-5 shrink-0"
        />
      ) : (
        <span className="size-5 shrink-0 rounded-full border border-dashed border-border" />
      )}
      <span
        className={`min-w-0 flex-1 truncate ${
          won ? "font-semibold text-primary" : p ? "text-white/90" : "text-muted-foreground"
        }`}
      >
        {p?.name ?? placeholder}
      </span>
      {score != null ? (
        <span
          className={`shrink-0 tabular-nums ${won ? "font-bold text-primary" : "text-white/70"}`}
        >
          {score}
        </span>
      ) : null}
    </div>
  );
}
