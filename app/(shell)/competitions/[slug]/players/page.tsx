import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/ui/country-flag";
import { cn } from "@/lib/utils";
import { getClient } from "@/lib/apollo/client";
import { CompetitionPlayersQuery } from "@/lib/graphql/operations/competition.operations";

type Roster = NonNullable<
  Awaited<ReturnType<typeof loadPlayers>>
>["rosters"][number];

async function loadPlayers(slug: string) {
  const { data } = await getClient().query({
    query: CompetitionPlayersQuery,
    variables: { slug },
  });
  return data?.competition ?? null;
}

const pct = (won: number, played: number) =>
  played > 0 ? `${Math.round((won / played) * 100)}%` : "—";

export default async function PlayersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = await loadPlayers(slug);
  if (!c) return null;

  // Rank by MVP score (Figma "Player MVP Rating"): score desc, then frames
  // won, then fewer frames played (more efficient), then name for stability.
  const rows = [...c.rosters].sort((a, b) => {
    const as = a.stat?.mvpScore ?? -1;
    const bs = b.stat?.mvpScore ?? -1;
    if (as !== bs) return bs - as;
    const af = a.stat?.framesWon ?? -1;
    const bf = b.stat?.framesWon ?? -1;
    if (af !== bf) return bf - af;
    const ap = a.stat?.framesPlayed ?? Infinity;
    const bp = b.stat?.framesPlayed ?? Infinity;
    if (ap !== bp) return ap - bp;
    return a.user.name.localeCompare(b.user.name);
  });

  // Only players who actually appeared get a numeric rank; the rest sort to
  // the bottom with a "—" rank.
  let nextRank = 0;
  const ranked = rows.map((r) => {
    const played = (r.stat?.framesPlayed ?? 0) > 0;
    return { r, rank: played ? (nextRank += 1) : null };
  });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No players locked in yet — approved teams will appear here once their
        rosters are set.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Player MVP Rating</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <Th sticky rowSpan={2} className="text-left">
                Name / Team
              </Th>
              <Th colSpan={2} group>
                Appearances
              </Th>
              <Th colSpan={4} group>
                Singles
              </Th>
              <Th colSpan={4} group>
                Doubles
              </Th>
              <Th colSpan={4} group>
                Total
              </Th>
              <Th rowSpan={2} group>
                B&amp;R
              </Th>
              <Th colSpan={2} group>
                MVP
              </Th>
            </tr>
            <tr className="border-b border-border">
              <Th group>#</Th>
              <Th>%</Th>
              <Th group>PL</Th>
              <Th>W</Th>
              <Th>L</Th>
              <Th>W%</Th>
              <Th group>PL</Th>
              <Th>W</Th>
              <Th>L</Th>
              <Th>W%</Th>
              <Th group>PL</Th>
              <Th>W</Th>
              <Th>L</Th>
              <Th>W%</Th>
              <Th group>Score</Th>
              <Th>Rank</Th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ r, rank }) => (
              <PlayerRow
                key={r.id}
                r={r}
                rank={rank}
                matchdayCount={c.matchdayCount}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 border-t border-border px-4 py-3 text-[11px] leading-4 text-muted-foreground">
        <p>
          # = Appearances (matchdays) · % = Appearance percentage · PL: Played ·
          W: Won · L: Lost · W%: Win percentage · B&amp;R: Break &amp; Run
        </p>
        <p>
          MVP Score = Appearances × 1 + Singles Won × 3 + Doubles Won × 2 +
          B&amp;R × 1
        </p>
      </div>
    </div>
  );
}

const MEDAL: Record<number, string> = {
  1: "bg-amber-400 text-amber-950",
  2: "bg-zinc-300 text-zinc-900",
  3: "bg-[#cd7f32] text-amber-50",
};
const ACCENT: Record<number, string> = {
  1: "border-l-4 border-amber-400",
  2: "border-l-4 border-zinc-300",
  3: "border-l-4 border-[#cd7f32]",
};

function PlayerRow({
  r,
  rank,
  matchdayCount,
}: {
  r: Roster;
  rank: number | null;
  matchdayCount: number;
}) {
  const s = r.stat;
  const ap = s?.matchesPlayed ?? 0;
  const apPct = matchdayCount > 0 ? `${Math.round((ap / matchdayCount) * 100)}%` : "—";
  const sPL = s?.singlesPlayed ?? 0;
  const sW = s?.singlesWon ?? 0;
  const dPL = s?.doublesPlayed ?? 0;
  const dW = s?.doublesWon ?? 0;
  const tPL = s?.framesPlayed ?? 0;
  const tW = s?.framesWon ?? 0;
  const medal = rank && rank <= 3 ? rank : 0;

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-secondary/20">
      {/* Sticky first column — opaque bg masks the scrolling cells behind it. */}
      <td
        className={cn(
          "sticky left-0 z-10 bg-card px-4 py-2.5",
          medal ? ACCENT[medal] : "",
        )}
      >
        <div className="flex items-center gap-3">
          <Link href={`/players/${r.user.username}`} className="shrink-0">
            <Avatar
              size="md"
              src={r.user.avatarUrl ?? undefined}
              fallback={r.user.name}
            />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/players/${r.user.username}`}
                className="truncate font-semibold hover:underline"
              >
                {r.user.name}
              </Link>
              <CountryFlag
                code={r.user.nationality}
                className="leading-none"
              />
              {s?.isMvp ? (
                <Badge variant="primary" size="sm">
                  MVP
                </Badge>
              ) : null}
            </div>
            <Link
              href={`/teams/${r.team.slug}`}
              className="truncate text-xs text-muted-foreground hover:underline"
            >
              {r.team.name}
            </Link>
          </div>
        </div>
      </td>

      <Td group>{ap}</Td>
      <Td>{apPct}</Td>

      <Td group>{sPL}</Td>
      <Td>{sW}</Td>
      <Td>{sPL - sW}</Td>
      <Td>{pct(sW, sPL)}</Td>

      <Td group>{dPL}</Td>
      <Td>{dW}</Td>
      <Td>{dPL - dW}</Td>
      <Td>{pct(dW, dPL)}</Td>

      <Td group>{tPL}</Td>
      <Td>{tW}</Td>
      <Td>{tPL - tW}</Td>
      <Td>{pct(tW, tPL)}</Td>

      <Td group>{s?.brWon ?? 0}</Td>

      <Td group className="font-bold text-foreground">
        {s?.mvpScore ?? 0}
      </Td>
      <td className="px-2 py-2.5 text-center">
        {rank === null ? (
          <span className="text-muted-foreground">—</span>
        ) : medal ? (
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-full text-xs font-bold",
              MEDAL[medal],
            )}
          >
            {rank}
          </span>
        ) : (
          <span className="font-semibold tabular-nums">{rank}</span>
        )}
      </td>
    </tr>
  );
}

function Th({
  children,
  colSpan,
  rowSpan,
  sticky = false,
  group = false,
  className,
}: {
  children: React.ReactNode;
  colSpan?: number;
  rowSpan?: number;
  sticky?: boolean;
  group?: boolean;
  className?: string;
}) {
  return (
    <th
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={cn(
        "whitespace-nowrap px-2 py-2 text-center font-semibold",
        sticky ? "sticky left-0 z-10 bg-card px-4" : "",
        group ? "border-l border-border" : "",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  group = false,
  className,
}: {
  children: React.ReactNode;
  group?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-2 py-2.5 text-center tabular-nums text-muted-foreground",
        group ? "border-l border-border/60" : "",
        className,
      )}
    >
      {children}
    </td>
  );
}
