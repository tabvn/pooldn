import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { Avatar } from "@/components/ui/avatar";
import { getClient } from "@/lib/apollo/client";
import { CompetitionEditableQuery } from "@/lib/graphql/operations/competition.operations";

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
  const { data } = await getClient().query({
    query: CompetitionEditableQuery,
    variables: { slug },
  });
  const c = data?.competition;
  if (!c) return null;

  const blocks = [...c.blocks].sort((a, b) => a.order - b.order);
  const totalFrames = blocks.reduce(
    (n, b) => n + (b.games || 0),
    0,
  );

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
                      <Badge variant="neutral">
                        {b.raceTo ? `Race to ${b.raceTo}` : `Race to ${c.raceToFrames}`}
                      </Badge>
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
            <Badge variant="primary">{totalFrames} frames total</Badge>
            <Badge variant="neutral">Race to {c.raceToFrames}</Badge>
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

        {/* Prize */}
        <Card>
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
          </CardContent>
        </Card>

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
