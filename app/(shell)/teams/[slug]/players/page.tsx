import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import { getClient } from "@/lib/apollo/client";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";

export default async function TeamPlayersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await getClient().query({
    query: TeamDetailQuery,
    variables: { slug },
  });
  const team = data?.team;
  if (!team) notFound();

  return (
    <Card data-testid="team-players">
      <CardHeader>
        <CardTitle>Players · {team.members.length}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {team.members.map((m) => (
          <Link
            key={m.id}
            href={`/players/${m.user.username}`}
            className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40 transition-colors"
          >
            <Avatar
              size="md"
              src={m.user.avatarUrl ?? undefined}
              fallback={m.user.name}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold">
                {m.user.name}
                {m.user.nationality ? (
                  <CountryFlag
                    code={m.user.nationality}
                    className="text-base leading-none"
                  />
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                @{m.user.username}
              </div>
            </div>
            {m.user.id === team.captain.id ? (
              <Badge variant="primary" size="sm">
                Captain
              </Badge>
            ) : null}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
