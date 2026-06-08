import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getClient } from "@/lib/apollo/client";
import { TeamsListQuery } from "@/lib/graphql/operations/team.operations";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";

export default async function TeamsPage() {
  const client = getClient();
  const [{ data }, viewerResult] = await Promise.all([
    client.query({ query: TeamsListQuery }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
  ]);
  const teams = data?.teams ?? [];
  const viewer = viewerResult.data?.viewer;
  const canCreate =
    viewer?.role === "TEAM_CAPTAIN" ||
    viewer?.role === "ORGANIZER" ||
    viewer?.role === "SUPER_ADMIN";

  return (
    <div className="p-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Every team currently active across PoolDN competitions.
          </p>
        </div>
        {canCreate ? (
          <Link href="/teams/new">
            <Button>Create team</Button>
          </Link>
        ) : null}
      </header>

      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">No teams yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/teams/${t.slug}`}
              data-testid={`team-card-${t.slug}`}
            >
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Avatar
                      size="lg"
                      src={t.logoUrl ?? undefined}
                      fallback={t.name}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="primary" size="sm">
                          {t.members.length}{" "}
                          {t.members.length === 1 ? "member" : "members"}
                        </Badge>
                        {!t.isActive ? (
                          <Badge variant="neutral" size="sm">
                            inactive
                          </Badge>
                        ) : null}
                      </div>
                      <CardTitle className="text-primary mt-1 truncate">
                        {t.name}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <div>Captain: {t.captain.name}</div>
                  <div>@{t.captain.username}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
