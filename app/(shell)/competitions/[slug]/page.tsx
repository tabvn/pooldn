import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/ui/country-flag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getClient } from "@/lib/apollo/client";
import {
  CompetitionOverviewQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";
import { LiveStandingsListener } from "@/components/live/live-standings-listener";
import { AboutCard } from "@/components/competition/about-card";
import { ConfirmedTeamsRow } from "@/components/competition/confirmed-teams-row";
import { InviteBanner } from "@/components/competition/invite-banner";

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
  if (c.status === "DRAFT") {
    const canManage =
      !!viewer &&
      (viewer.role === "SUPER_ADMIN" || viewer.id === c.organizer?.id);
    redirect(canManage ? `/competitions/${slug}/edit` : "/competitions");
  }

  const isCompleted = c.status === "COMPLETED";
  const winner = isCompleted ? c.standings[0] : null;
  const runnerUp = isCompleted ? c.standings[1] : null;
  const thirdPlace = isCompleted ? c.standings[2] : null;
  const mvp = isCompleted ? c.playerStats.find((p) => p.isMvp) : null;

  // Round-40 — derive top scorers + leaderboards from playerCompStats for the
  // completed-state recap. Frames-won % among players with ≥1 frame, then
  // raw frames-won as the tiebreak. Top 5 surface in the recap card.
  const NUM = new Intl.NumberFormat("en-US");
  const prizePoolNum = c.prizePool ? Number(c.prizePool) : 0;
  const distribution = isCompleted && prizePoolNum > 0
    ? [
        { label: "1st", pct: 60, amount: Math.round(prizePoolNum * 0.6), winner: winner?.team },
        { label: "2nd", pct: 25, amount: Math.round(prizePoolNum * 0.25), winner: runnerUp?.team },
        { label: "3rd", pct: 15, amount: Math.round(prizePoolNum * 0.15), winner: thirdPlace?.team },
      ]
    : [];
  const topScorers = isCompleted
    ? [...c.playerStats]
        .filter((p) => p.framesPlayed > 0)
        .sort((a, b) => {
          const ap = a.framesWon / a.framesPlayed;
          const bp = b.framesWon / b.framesPlayed;
          if (bp !== ap) return bp - ap;
          return b.framesWon - a.framesWon;
        })
        .slice(0, 5)
    : [];

  return (
    <div className="space-y-8">
      {/* Round-49 — captain-facing invite banner. Renders one banner per
          INVITED team the viewer captains, with Accept (routes to the
          apply form) and Decline (cancels the row). */}
      <InviteBanner competitionSlug={slug} applications={c.applications} />

      {/* Round-48 — "About this competition" surfaced at the top of the
          overview so captains/players see the apply-relevant config
          (type, rules, dates, weekdays, venue mode, application mode)
          before they click Apply. Hidden on COMPLETED comps where the
          winner banner takes the headline spot. */}
      {!isCompleted ? <AboutCard c={c} /> : null}

      {/* Winner + MVP banner — only when the competition is COMPLETED */}
      {isCompleted ? (
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-purple-600/30 md:grid-cols-2">
          <div
            className="flex flex-col items-center gap-2 p-8"
            style={{
              background:
                "linear-gradient(135deg, #4a106e 0%, #9810fa 50%, #1c2280 100%)",
            }}
          >
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
              <div className="text-lg font-semibold text-white hover:underline">
                {winner?.team.name ?? "TBD"}
              </div>
            </Link>
            <Badge variant="primary">Winner!</Badge>
          </div>
          <div
            className="flex flex-col items-center gap-2 p-8"
            style={{
              background:
                "linear-gradient(135deg, #1c2280 0%, #9810fa 50%, #0b4f4a 100%)",
            }}
          >
            <Link
              href={mvp ? `/players/${mvp.user.username}` : "#"}
              className="flex flex-col items-center gap-2 hover:opacity-90"
            >
              <Avatar
                size="xl"
                src={mvp?.user.avatarUrl ?? undefined}
                fallback={mvp?.user.name ?? "—"}
              />
              <div className="flex items-center gap-2 text-lg font-semibold text-white hover:underline">
                <span>{mvp?.user.name ?? "—"}</span>
                {mvp?.user.nationality ? (
                  <CountryFlag
                    code={mvp.user.nationality}
                    className="text-2xl leading-none"
                  />
                ) : null}
              </div>
            </Link>
            <Badge variant="primary">MVP</Badge>
          </div>
        </div>
      ) : null}

      {/* Round-40 — completed-state recap: prize distribution, podium,
          top scorers. Renders below the winner+MVP banner. */}
      {isCompleted ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {distribution.length > 0 ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Prize distribution
              </h3>
              <ul className="space-y-2">
                {distribution.map((d) => (
                  <li
                    key={d.label}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Badge variant="primary" size="sm">
                        {d.label}
                      </Badge>
                      {d.winner ? (
                        <Link
                          href={`/teams/${d.winner.slug}`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                        >
                          <Avatar
                            size="sm"
                            src={d.winner.logoUrl ?? undefined}
                            fallback={d.winner.name}
                            shape="team"
                          />
                          {d.winner.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {NUM.format(d.amount)} {c.currency}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {topScorers.length > 0 ? (
            <div className="rounded-xl border border-border bg-card p-4" data-testid="top-scorers">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Top scorers
              </h3>
              <ol className="space-y-1.5">
                {topScorers.map((p, idx) => {
                  const pct = Math.round(
                    (p.framesWon / Math.max(1, p.framesPlayed)) * 100,
                  );
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/players/${p.user.username}`}
                        className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-secondary/40"
                      >
                        <span className="w-5 text-right font-mono text-xs font-bold text-muted-foreground">
                          {idx + 1}
                        </span>
                        <Avatar
                          size="sm"
                          src={p.user.avatarUrl ?? undefined}
                          fallback={p.user.name}
                        />
                        <span className="min-w-0 flex-1 text-sm">
                          {p.user.name}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {p.framesWon}/{p.framesPlayed}
                        </span>
                        <Badge variant="primary" size="sm">
                          {pct}%
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Round-47 — Confirmed teams strip (Figma "Competition Public View
          / Apply as a Team"). Visible on every state; once ONGOING / COMPLETED
          the standings table below carries the team list so we collapse this
          to a compact strip just to confirm who's in. */}
      {c.applications.filter((a) => a.status === "APPROVED").length > 0 ? (
        <ConfirmedTeamsRow
          competitionName={c.name}
          competitionStatus={c.status}
          rosterLocked={c.rosterLocked}
          applications={c.applications}
          viewerId={viewer?.id ?? null}
          viewerRole={viewer?.role ?? null}
          maxTeams={c.maxTeams ?? null}
        />
      ) : c.status === "OPEN_FOR_APPLICATIONS" ? (
        <section
          className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground"
          data-testid="confirmed-teams-empty"
        >
          No teams confirmed yet. Be the first — apply with your team.
        </section>
      ) : null}

      {/* Round-15 — live banner when any IN_PROGRESS matches exist. */}
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

      {/* Standings */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          League Standings
          {c.status === "COMPLETED" ? (
            <span className="ml-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
              Final
            </span>
          ) : null}
        </h2>
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 sticky top-0 bg-card">#</TableHead>
                <TableHead className="sticky top-0 bg-card">Team</TableHead>
                <TableHead className="text-right sticky top-0 bg-card">P</TableHead>
                <TableHead className="text-right sticky top-0 bg-card">W</TableHead>
                <TableHead className="text-right sticky top-0 bg-card">D</TableHead>
                <TableHead className="text-right sticky top-0 bg-card">L</TableHead>
                <TableHead className="text-right sticky top-0 bg-card">PF</TableHead>
                <TableHead className="text-right sticky top-0 bg-card">PA</TableHead>
                <TableHead className="text-right sticky top-0 bg-card">PD</TableHead>
                <TableHead className="text-right sticky top-0 bg-card">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.standings.map((s, idx) => {
                const isChampion = idx === 0 && isCompleted;
                const isLeader = idx === 0 && !isCompleted;
                const isLast =
                  idx === c.standings.length - 1 && c.standings.length > 1;
                return (
                  <TableRow
                    key={s.id}
                    data-highlight={
                      isChampion || isLeader
                        ? "success"
                        : isLast
                          ? "danger"
                          : undefined
                    }
                    className={`${idx % 2 === 1 ? "bg-secondary/20" : ""} ${
                      isChampion
                        ? "ring-2 ring-warning/40 bg-warning/5"
                        : ""
                    }`}
                  >
                    <TableCell className="font-semibold tabular-nums">
                      {isChampion ? (
                        <span className="inline-flex items-center gap-1 text-warning">
                          🏆 1
                        </span>
                      ) : (
                        s.position ?? idx + 1
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/teams/${s.team.slug}`}
                        className="inline-flex items-center gap-2 hover:underline"
                      >
                        <Avatar
                          size="sm"
                          src={s.team.logoUrl ?? undefined}
                          fallback={s.team.name}
                          shape="team"
                        />
                        {s.team.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.played}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.won}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.drawn}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.lost}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.pointsFor}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.pointsAgainst}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        s.pointDiff > 0
                          ? "text-success"
                          : s.pointDiff < 0
                            ? "text-destructive"
                            : ""
                      }`}
                    >
                      {s.pointDiff > 0 ? `+${s.pointDiff}` : s.pointDiff}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-primary">
                      {s.points}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          P: Played · W: Won · D: Drawn · L: Lost · PF: Points For · PA: Points
          Against · PD: Point Difference · Pts: Points
        </p>
      </section>
    </div>
  );
}
