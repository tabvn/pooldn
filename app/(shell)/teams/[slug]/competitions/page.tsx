import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompetitionStatusChip } from "@/components/ui/status-chip";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { getClient } from "@/lib/apollo/client";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";

export default async function TeamCompetitionsPage({
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

  const competitions = team.applications
    .map((a) => ({ comp: a.competition, status: a.status, submitted: a.submittedAt }))
    .filter(
      (x, i, arr) =>
        arr.findIndex((y) => y.comp.id === x.comp.id) === i,
    );

  return (
    <Card data-testid="team-competitions">
      <CardHeader>
        <CardTitle>Competitions · {competitions.length}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {competitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No competition history yet.
          </p>
        ) : (
          competitions.map(({ comp, status, submitted }) => (
            <Link
              key={comp.id}
              href={`/competitions/${comp.slug}`}
              className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40"
            >
              <Avatar
                size="sm"
                src={comp.bannerUrl ?? undefined}
                fallback={comp.name}
                shape="competition"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {comp.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  Applied <LocalDateTime value={submitted} variant="date" /> ·{" "}
                  {status.toLowerCase()}
                </div>
              </div>
              <CompetitionStatusChip status={comp.status} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
