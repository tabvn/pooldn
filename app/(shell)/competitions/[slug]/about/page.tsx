import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { Avatar } from "@/components/ui/avatar";
import { getClient } from "@/lib/apollo/client";
import { CompetitionEditableQuery } from "@/lib/graphql/operations/competition.operations";
import { VenuesListQuery } from "@/lib/graphql/operations/venue.operations";

const NUM = new Intl.NumberFormat("en-US");

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <dt className="text-xs uppercase text-muted-foreground tracking-wide">
        {label}
      </dt>
      <dd className="text-sm font-medium text-right">{value}</dd>
    </div>
  );
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = getClient();
  const { data } = await client.query({
    query: CompetitionEditableQuery,
    variables: { slug },
  });
  const c = data?.competition;
  if (!c) return null;

  // Round-19 — list city venues so About can deeplink them.
  const venuesRes = c.city?.id
    ? await client.query({
        query: VenuesListQuery,
        variables: { cityId: c.city.id },
        errorPolicy: "ignore",
      })
    : null;
  const venues = venuesRes?.data?.venues ?? [];

  // Default prize distribution if no explicit split is configured: winner
  // takes 60% / 25% / 15%. Round to whole units of the comp's currency.
  const prizePoolNum = c.prizePool ? Number(c.prizePool) : 0;
  const distribution = prizePoolNum > 0
    ? [
        { label: "1st", pct: 60, amount: Math.round(prizePoolNum * 0.6) },
        { label: "2nd", pct: 25, amount: Math.round(prizePoolNum * 0.25) },
        { label: "3rd", pct: 15, amount: Math.round(prizePoolNum * 0.15) },
      ]
    : [];

  const blocks = [...c.blocks].sort((a, b) => a.order - b.order);
  const totalFrames = blocks.reduce(
    (n, b) => n + (b.games || 0),
    0,
  );
  // Round-60 — "Race to X" is a 1v1 (INDIVIDUAL) concept; a Team / Doubles
  // match is a fixed set of games (the block list), so we hide the race-to
  // badges on team-competition frames.
  const showRaceTo = c.type === "INDIVIDUAL";

  return (
    <div className="space-y-6">
      {/* Description */}
      {c.description ? (
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {c.description}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Match structure — the canonical ordered block list */}
      <Card data-testid="about-match-structure">
        <CardHeader>
          <CardTitle>Match structure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No structure configured yet.
            </p>
          ) : (
            <ol className="space-y-2">
              {blocks.flatMap((b, i) => {
                const items = [
                  <li
                    key={`b-${b.id}`}
                    className="rounded-lg border border-border bg-background px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Block {i + 1}
                        </div>
                        <div className="text-sm font-semibold mt-0.5">
                          {b.games} ×{" "}
                          {b.type
                            .replace("_", " ")
                            .toLowerCase()
                            .replace(/^./, (s) => s.toUpperCase())}
                        </div>
                      </div>
                      {showRaceTo ? (
                        <Badge variant="neutral">
                          {b.raceTo
                            ? `Race to ${b.raceTo}`
                            : `Race to ${c.raceToFrames}`}
                        </Badge>
                      ) : null}
                    </div>
                  </li>,
                ];
                if (b.breakAfterMin && b.breakAfterMin > 0) {
                  items.push(
                    <li
                      key={`brk-${b.id}`}
                      className="flex items-center gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-2 text-xs font-medium text-amber-300"
                    >
                      <span>⏸</span>
                      Break — {b.breakAfterMin} min before next block
                    </li>,
                  );
                }
                return items;
              })}
            </ol>
          )}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <Badge variant="primary">
              {totalFrames} {showRaceTo ? "frames" : "games"} total
            </Badge>
            {showRaceTo ? (
              <Badge variant="neutral">Race to {c.raceToFrames}</Badge>
            ) : null}
            {c.breakAndRunRule ? (
              <Badge variant="success">Break &amp; Run rule</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Participants */}
        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row
                label="Min / max teams"
                value={`${c.minTeams}${c.maxTeams ? ` – ${c.maxTeams}` : "+"}`}
              />
              <Row
                label="Players per team"
                value={`${c.minPlayersPerTeam}${
                  c.maxPlayersPerTeam ? ` – ${c.maxPlayersPerTeam}` : "+"
                }`}
              />
              <Row
                label="Type"
                value={String(c.type).toLowerCase()}
              />
              <Row
                label="Format"
                value={String(c.format).replace(/_/g, " ").toLowerCase()}
              />
              <Row
                label="Game"
                value={String(c.gameType).replace("_", "-").toLowerCase()}
              />
            </dl>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row
                label="Scheduling"
                value={String(c.schedulingType ?? "FLEXIBLE")
                  .replace(/_/g, " ")
                  .toLowerCase()}
              />
              <Row
                label="Starts"
                value={
                  c.startDate ? (
                    <LocalDateTime value={c.startDate} variant="date" />
                  ) : (
                    "TBD"
                  )
                }
              />
              <Row
                label="Ends"
                value={
                  c.endDate ? (
                    <LocalDateTime value={c.endDate} variant="date" />
                  ) : (
                    "TBD"
                  )
                }
              />
              <Row
                label="City"
                value={
                  c.city?.id ? (
                    <span>{(c.city as { name?: string }).name ?? "—"}</span>
                  ) : (
                    "—"
                  )
                }
              />
            </dl>
          </CardContent>
        </Card>

        {/* Prize + distribution */}
        <Card data-testid="about-prize">
          <CardHeader>
            <CardTitle>Prize</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row
                label="Prize pool"
                value={
                  c.prizePool
                    ? `${NUM.format(Number(c.prizePool))} ${c.currency}`
                    : "—"
                }
              />
              <Row label="Currency" value={c.currency} />
            </dl>
            {distribution.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {distribution.map((d) => (
                  <li
                    key={d.label}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Badge variant="primary" size="sm">
                        {d.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {d.pct}%
                      </span>
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {NUM.format(d.amount)} {c.currency}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        {/* Rules */}
        <Card data-testid="about-rules">
          <CardHeader>
            <CardTitle>Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Win points" value={c.pointsWin ?? "—"} />
              <Row label="Draw points" value={c.pointsDraw ?? "—"} />
              <Row label="Loss points" value={c.pointsLoss ?? "—"} />
              <Row
                label="Break & Run rule"
                value={
                  c.breakAndRunRule ? (
                    <Badge variant="success" size="sm">
                      ON
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">off</span>
                  )
                }
              />
              <Row
                label="Tie-breakers"
                value={
                  <ol className="text-right text-sm">
                    <li>1. Points</li>
                    <li>2. Head-to-head</li>
                    <li>3. Point difference</li>
                    <li>4. Points for</li>
                    <li>5. Team name (A–Z)</li>
                  </ol>
                }
              />
              <Row
                label="Rules document"
                value={
                  c.rulesUrl ? (
                    <Link
                      href={c.rulesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      data-testid="about-rules-link"
                    >
                      Open rules ↗
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
            </dl>
          </CardContent>
        </Card>

        {/* Venues — every venue in the host city */}
        {venues.length > 0 ? (
          <Card data-testid="about-venues" className="md:col-span-2">
            <CardHeader>
              <CardTitle>Venues</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {venues.map((v) => (
                <Link
                  key={v.id}
                  href={`/venues/${v.slug}`}
                  className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-primary/40"
                >
                  <Avatar
                    size="sm"
                    src={v.imageUrl ?? undefined}
                    fallback={v.name}
                    shape="competition"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{v.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {v.city?.name}
                      {v.tableCount ? ` · ${v.tableCount} tables` : ""}
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {/* Organizer */}
        <Card>
          <CardHeader>
            <CardTitle>Organizer</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Avatar
              size="lg"
              src={null}
              fallback={c.organizer.id ?? "organizer"}
            />
            <div>
              <Link
                href={`/profile/${(c.organizer as { username?: string }).username ?? ""}`}
                className="text-sm font-semibold hover:underline"
              >
                {(c.organizer as { name?: string }).name ?? "Organizer"}
              </Link>
              <div className="text-xs text-muted-foreground">
                @
                {(c.organizer as { username?: string }).username ?? "—"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
