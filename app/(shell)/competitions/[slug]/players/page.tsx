import Link from "next/link";
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
import { CompetitionPlayersQuery } from "@/lib/graphql/operations/competition.operations";

export default async function PlayersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await getClient().query({
    query: CompetitionPlayersQuery,
    variables: { slug },
  });
  const c = data?.competition;
  if (!c) return null;

  const players = [...c.playerStats].sort((a, b) => {
    if (a.isMvp !== b.isMvp) return a.isMvp ? -1 : 1;
    return b.framesWon - a.framesWon;
  });

  if (players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No player stats recorded yet.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Matches</TableHead>
            <TableHead className="text-right">Frames Won</TableHead>
            <TableHead className="text-right">Frames Played</TableHead>
            <TableHead className="text-right">Win %</TableHead>
            <TableHead className="text-right">MVP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((p) => {
            const pct =
              p.framesPlayed === 0
                ? 0
                : Math.round((p.framesWon / p.framesPlayed) * 100);
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <Link
                    href={`/players/${p.user.username}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    <Avatar
                      size="sm"
                      src={p.user.avatarUrl ?? undefined}
                      fallback={p.user.name}
                    />
                    <div>
                      <div className="flex items-center gap-2 font-semibold">
                        {p.user.name}
                        {p.user.nationality ? (
                          <CountryFlag
                            code={p.user.nationality}
                            className="text-base leading-none"
                          />
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        @{p.user.username}
                      </div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-right">{p.matchesPlayed}</TableCell>
                <TableCell className="text-right">{p.framesWon}</TableCell>
                <TableCell className="text-right">{p.framesPlayed}</TableCell>
                <TableCell className="text-right">{pct}%</TableCell>
                <TableCell className="text-right">
                  {p.isMvp ? <Badge variant="primary">MVP</Badge> : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
