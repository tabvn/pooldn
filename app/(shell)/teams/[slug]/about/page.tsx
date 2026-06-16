import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { getClient } from "@/lib/apollo/client";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";

export default async function TeamAboutPage({
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>About this team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {team.description ? (
            <p className="whitespace-pre-line">{team.description}</p>
          ) : (
            <p className="italic text-muted-foreground">
              No description yet.
            </p>
          )}
          <div className="text-xs text-muted-foreground">
            {!team.isActive ? (
              <Badge variant="neutral" size="sm">
                Inactive
              </Badge>
            ) : (
              <Badge variant="success" size="sm">
                Active
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Captain</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href={`/players/${team.captain.username}`}
            className="flex items-center gap-3 hover:underline"
          >
            <Avatar
              size="lg"
              src={team.captain.avatarUrl ?? undefined}
              fallback={team.captain.name}
            />
            <div>
              <div className="text-sm font-semibold">
                {team.captain.name}
                <CountryFlag
                  code={team.captain.nationality}
                  className="ml-1.5 leading-none"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                @{team.captain.username}
              </div>
            </div>
          </Link>
          <div className="mt-3 text-xs text-muted-foreground">
            Followers: {team.followerCount} ·{" "}
            <Link
              href={`/teams/${slug}/followers`}
              className="text-primary hover:underline"
            >
              see who
            </Link>
          </div>
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {team.applications.length === 0 ? (
            <p>No applications submitted yet.</p>
          ) : (
            <p>
              First application:{" "}
              <LocalDateTime
                value={
                  [...team.applications].sort(
                    (a, b) =>
                      new Date(a.submittedAt).getTime() -
                      new Date(b.submittedAt).getTime(),
                  )[0]!.submittedAt
                }
                variant="date"
              />
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
