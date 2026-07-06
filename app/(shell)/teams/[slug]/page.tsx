import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { CountryFlag } from "@/components/ui/country-flag";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { CaptainJoinRequestsPanel } from "@/components/team/captain-join-requests-panel";
import { getClient } from "@/lib/apollo/client";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";

/**
 * Round-65 — Overview tab now also carries the About content (description,
 * captain, history). The standalone About tab was merged in; the Players and
 * Recent Competitions previews moved out (their dedicated tabs cover them).
 */
export default async function TeamOverviewPage({
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
    <div className="space-y-6">
      <CaptainJoinRequestsPanel
        teamId={team.id}
        teamSlug={slug}
        captainId={team.captain.id}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>About this team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {team.description ? (
              <p className="whitespace-pre-line">{team.description}</p>
            ) : (
              <p className="italic text-muted-foreground">No description yet.</p>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Home Venue</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {team.homeVenue ? (
              <Link
                href={`/venues/${team.homeVenue.slug}`}
                className="flex items-center gap-3 hover:underline"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                  <MapPin className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {team.homeVenue.name}
                  </div>
                  {team.homeVenue.city ? (
                    <div className="text-xs text-muted-foreground">
                      {team.homeVenue.city.name}
                    </div>
                  ) : null}
                </div>
              </Link>
            ) : (
              <p className="italic text-muted-foreground">No home venue set.</p>
            )}
          </CardContent>
        </Card>

        <Card>
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
    </div>
  );
}
