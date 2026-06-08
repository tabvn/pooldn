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
import { CompetitionOverviewQuery } from "@/lib/graphql/operations/competition.operations";

export default async function CompetitionOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await getClient().query({
    query: CompetitionOverviewQuery,
    variables: { slug },
  });
  const c = data?.competition;
  if (!c) return null;

  const isCompleted = c.status === "COMPLETED";
  const winner = isCompleted ? c.standings[0] : null;
  const mvp = isCompleted ? c.playerStats.find((p) => p.isMvp) : null;

  return (
    <div className="space-y-8">
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
            <Avatar
              size="xl"
              src={winner?.team.logoUrl ?? undefined}
              fallback={winner?.team.name ?? "—"}
            />
            <div className="text-lg font-semibold text-white">
              {winner?.team.name ?? "TBD"}
            </div>
            <Badge variant="primary">Winner!</Badge>
          </div>
          <div
            className="flex flex-col items-center gap-2 p-8"
            style={{
              background:
                "linear-gradient(135deg, #1c2280 0%, #9810fa 50%, #0b4f4a 100%)",
            }}
          >
            <Avatar
              size="xl"
              src={mvp?.user.avatarUrl ?? undefined}
              fallback={mvp?.user.name ?? "—"}
            />
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <span>{mvp?.user.name ?? "—"}</span>
              {mvp?.user.nationality ? (
                <CountryFlag
                  code={mvp.user.nationality}
                  className="text-2xl leading-none"
                />
              ) : null}
            </div>
            <Badge variant="primary">MVP</Badge>
          </div>
        </div>
      ) : null}

      {/* Standings */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">League Standings</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">P</TableHead>
                <TableHead className="text-right">W</TableHead>
                <TableHead className="text-right">D</TableHead>
                <TableHead className="text-right">L</TableHead>
                <TableHead className="text-right">PF</TableHead>
                <TableHead className="text-right">PA</TableHead>
                <TableHead className="text-right">PD</TableHead>
                <TableHead className="text-right">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.standings.map((s, idx) => (
                <TableRow
                  key={s.id}
                  data-highlight={
                    idx === 0
                      ? "success"
                      : idx === c.standings.length - 1 && c.standings.length > 1
                        ? "danger"
                        : undefined
                  }
                >
                  <TableCell className="font-semibold">
                    {s.position ?? idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Avatar
                        size="sm"
                        src={s.team.logoUrl ?? undefined}
                        fallback={s.team.name}
                      />
                      {s.team.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{s.played}</TableCell>
                  <TableCell className="text-right">{s.won}</TableCell>
                  <TableCell className="text-right">{s.drawn}</TableCell>
                  <TableCell className="text-right">{s.lost}</TableCell>
                  <TableCell className="text-right">{s.pointsFor}</TableCell>
                  <TableCell className="text-right">
                    {s.pointsAgainst}
                  </TableCell>
                  <TableCell className="text-right">{s.pointDiff}</TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {s.points}
                  </TableCell>
                </TableRow>
              ))}
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
