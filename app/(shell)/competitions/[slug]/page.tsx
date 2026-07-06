import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { CountryFlag } from "@/components/ui/country-flag";
import { getClient } from "@/lib/apollo/client";
import {
  CompetitionOverviewQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";
import { LiveStandingsListener } from "@/components/live/live-standings-listener";
import { InviteBanner } from "@/components/competition/invite-banner";

const STANDINGS_LEGEND =
  "P: Played • W: Won • D: Drawn • L: Lost • PF: Points For • PA: Points Against • PD: Point Difference • Pts: Points";

type StandingRow = {
  id: string;
  position?: number | null;
  team: { slug: string; name: string; logoUrl?: string | null };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointDiff: number;
  points: number;
};

/**
 * Round-62 — Figma "League Standings" table (node 493:13630). The #/Team
 * columns are frozen to the left (with the design's drop shadow) so the
 * stat columns scroll horizontally on narrow viewports. Completed comps
 * get the podium colours — 1st in lime, 3rd in bronze; ongoing comps only
 * highlight the current leader. Per the Figma, PA is dropped from the
 * visible columns (PD already nets it out) but kept in the legend.
 */
function StandingsTable({
  standings,
  isCompleted,
}: {
  standings: StandingRow[];
  isCompleted: boolean;
}) {
  // Stat columns get a min-width + nowrap so the table stays wider than a
  // phone screen — that forces the horizontal scroll and makes the frozen
  // #/Team columns actually do their job (mirrors the players table, which
  // overflows naturally because it has many columns).
  const stat =
    "min-w-[48px] whitespace-nowrap px-3 py-2 text-right tabular-nums text-white/90";
  const statHead =
    "min-w-[48px] whitespace-nowrap px-3 py-2 text-right font-semibold text-white/90";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {/* Frozen #/Team group. The # column is exactly w-12 (48px) with
                box-border, so Team's left-12 offset lines up precisely. */}
            <th className="sticky left-0 z-20 w-12 bg-card px-3 py-2 text-right font-semibold text-white/90">
              #
            </th>
            <th className="sticky left-12 z-20 min-w-[160px] bg-card px-3 py-2 text-left font-semibold text-white/90 shadow-[8px_0_8px_-6px_rgba(0,0,0,0.3)]">
              Team
            </th>
            <th className={statHead}>P</th>
            <th className={statHead}>W</th>
            <th className={statHead}>D</th>
            <th className={statHead}>L</th>
            <th className={statHead}>PF</th>
            <th className={statHead}>PD</th>
            <th className="min-w-[80px] whitespace-nowrap py-2 pl-3 pr-6 text-right font-semibold text-white/90">
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, idx) => {
            const pos = s.position ?? idx + 1;
            const isFirst = idx === 0;
            const isThird = isCompleted && idx === 2;
            const rowBg = isFirst
              ? "bg-primary/10"
              : isThird
                ? "bg-amber-950"
                : idx % 2 === 1
                  ? "bg-white/[0.03]"
                  : "bg-card";
            // The frozen #/Team cells must be FULLY OPAQUE or the stat columns
            // scroll visibly through them. A translucent tint won't do, so we
            // layer a flat tint gradient over a solid card base (same composite
            // colour as the row's translucent highlight, but opaque). Done via
            // inline style because Tailwind can't emit an arbitrary gradient
            // with nested rgba() commas.
            const CARD = "#161b1d";
            const stickyStyle = isFirst
              ? {
                  backgroundColor: CARD,
                  backgroundImage:
                    "linear-gradient(rgba(208,243,13,0.1),rgba(208,243,13,0.1))",
                }
              : isThird
                ? { backgroundColor: "#461901" }
                : idx % 2 === 1
                  ? {
                      backgroundColor: CARD,
                      backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.03),rgba(255,255,255,0.03))",
                    }
                  : { backgroundColor: CARD };
            const accent = isFirst
              ? "text-primary"
              : isThird
                ? "text-amber-600"
                : "text-white/90";
            return (
              <tr key={s.id} className={`border-b border-border ${rowBg}`}>
                <td
                  style={stickyStyle}
                  className={`sticky left-0 z-10 w-12 px-3 py-2 text-right font-semibold tabular-nums ${accent}`}
                >
                  {pos}
                </td>
                <td
                  style={stickyStyle}
                  className={`sticky left-12 z-10 min-w-[160px] px-3 py-2 shadow-[8px_0_8px_-6px_rgba(0,0,0,0.3)]`}
                >
                  <Link
                    href={`/teams/${s.team.slug}`}
                    className={`inline-flex items-center gap-3 whitespace-nowrap font-semibold hover:underline ${accent}`}
                  >
                    <Avatar
                      size="sm"
                      src={s.team.logoUrl ?? undefined}
                      fallback={s.team.name}
                      shape="team"
                      className="size-6"
                    />
                    {s.team.name}
                  </Link>
                </td>
                <td className={stat}>{s.played}</td>
                <td className={stat}>{s.won}</td>
                <td className={stat}>{s.drawn}</td>
                <td className={stat}>{s.lost}</td>
                <td className={stat}>{s.pointsFor}</td>
                <td className={stat}>
                  {s.pointDiff > 0 ? `+${s.pointDiff}` : s.pointDiff}
                </td>
                <td
                  className={`min-w-[80px] whitespace-nowrap py-2 pl-3 pr-6 text-right font-semibold tabular-nums ${accent}`}
                >
                  {s.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function CompetitionOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = getClient();
  const [{ data }, viewerResult] = await Promise.all([
    client.query({ query: CompetitionOverviewQuery, variables: { slug } }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
  ]);
  const c = data?.competition;
  if (!c) return null;
  const viewer = viewerResult.data?.viewer ?? null;

  // Round-55 — DRAFT competitions don't have a public overview. The
  // organizer (or admin) gets bounced into the 4-tab setup wizard at
  // /edit — that IS the Figma "Draft Competition" screen. Anyone else
  // who somehow lands here (CASL hides DRAFTs from non-org viewers, so
  // this is mostly a safety net) goes to the browse page.
  const canManage =
    !!viewer &&
    (viewer.role === "SUPER_ADMIN" || viewer.id === c.organizer?.id);
  if (c.status === "DRAFT") {
    redirect(canManage ? `/competitions/${slug}/edit` : "/competitions");
  }
  // Round-60 — an upcoming (Accepting / Applications-closed) comp leads
  // with the Applications tab (Figma node 299:9506); there's no Overview
  // in that stage. Bounce everyone off the bare overview URL onto the
  // Applications view so the default landing matches the tab bar.
  if (
    c.status === "OPEN_FOR_APPLICATIONS" ||
    c.status === "APPLICATIONS_CLOSED"
  ) {
    redirect(`/competitions/${slug}/applications`);
  }

  const isCompleted = c.status === "COMPLETED";
  const winner = isCompleted ? c.standings[0] : null;
  const mvp = isCompleted ? c.playerStats.find((p) => p.isMvp) : null;

  return (
    <div className="space-y-8">
      {/* Round-49 — captain-facing invite banner. Renders one banner per
          INVITED team the viewer captains, with Accept (routes to the
          apply form) and Decline (cancels the row). */}
      <InviteBanner competitionSlug={slug} applications={c.applications} />

      {/* Round-63 — ONGOING overview no longer repeats the "About this
          competition" block (the About tab covers it) or the "Confirmed
          teams" strip (League Standings already lists every team). */}

      {/* Round-15 — live banner when the competition is in progress. */}
      {c.status === "ONGOING" ? (
        <div
          className="flex items-center gap-3 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
          data-testid="ongoing-live-banner"
        >
          <span className="inline-block size-2 rounded-full bg-success animate-pulse" />
          Competition is live — matchdays update in real time as matches complete.
        </div>
      ) : null}

      <LiveStandingsListener competitionId={c.id} />

      {/* Round-62 — Figma completed overview (node 493:13608): winner + MVP
          banner, League Standings, and the legend stacked inside one card. */}
      {isCompleted ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Winner + MVP banner (node 493:13616) */}
          <div
            className="grid grid-cols-2 gap-3 border-b border-border p-6"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #3c0366 0%, #052f4a 100%)",
            }}
          >
            <div className="flex min-w-0 flex-col items-center gap-3">
              <Link
                href={winner ? `/teams/${winner.team.slug}` : "#"}
                className="flex flex-col items-center gap-2 hover:opacity-90"
              >
                <Avatar
                  size="xl"
                  src={winner?.team.logoUrl ?? undefined}
                  fallback={winner?.team.name ?? "—"}
                  shape="team"
                />
                <div className="text-center text-xl font-semibold text-white/90 hover:underline">
                  {winner?.team.name ?? "TBD"}
                </div>
              </Link>
              <span className="text-base font-semibold text-primary">
                Winner!
              </span>
            </div>
            <div className="flex min-w-0 flex-col items-center gap-3">
              <Link
                href={mvp ? `/players/${mvp.user.username}` : "#"}
                className="flex flex-col items-center gap-2 hover:opacity-90"
              >
                <Avatar
                  size="xl"
                  src={mvp?.user.avatarUrl ?? undefined}
                  fallback={mvp?.user.name ?? "—"}
                />
                <div className="flex items-center gap-2 text-center text-xl font-semibold text-white/90 hover:underline">
                  <span>{mvp?.user.name ?? "—"}</span>
                  {mvp?.user.nationality ? (
                    <CountryFlag
                      code={mvp.user.nationality}
                      className="text-2xl leading-none"
                    />
                  ) : null}
                </div>
              </Link>
              <span className="text-base font-semibold text-primary">MVP</span>
            </div>
          </div>

          {/* League Standings header (node 493:13627) */}
          <div className="flex items-center justify-between border-b border-border p-6">
            <span className="text-base font-semibold text-white/50">
              League Standings
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Final
            </span>
          </div>

          <StandingsTable standings={c.standings} isCompleted />

          {/* Legend footer (node 493:13721) */}
          <div className="bg-white/5 p-4 text-sm text-white/70">
            {STANDINGS_LEGEND}
          </div>
        </div>
      ) : (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">League Standings</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <StandingsTable standings={c.standings} isCompleted={false} />
            <div className="bg-white/5 p-4 text-sm text-white/70">
              {STANDINGS_LEGEND}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
