import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VenueActionsMenu } from "@/components/venue/venue-actions-menu";
import { DetailHero } from "@/components/layout/detail-hero";
import { getClient } from "@/lib/apollo/client";
import { getViewer } from "@/lib/auth/server";
import { VenueDetailQuery } from "@/lib/graphql/operations/venue.operations";

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ data }, viewer] = await Promise.all([
    getClient().query({ query: VenueDetailQuery, variables: { slug } }),
    getViewer(),
  ]);
  const v = data?.venue;
  if (!v) notFound();
  const canEdit =
    viewer?.role === "ORGANIZER" || viewer?.role === "SUPER_ADMIN";

  return (
    <div className="flex flex-col">
      <DetailHero
        title={v.name}
        actions={<VenueActionsMenu slug={slug} canEdit={canEdit} />}
        meta={
          <>
            <span className="inline-flex items-center rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              Venue
            </span>
            <span>{v.city.name}</span>
            {v.tableCount ? (
              <Badge variant="primary">{v.tableCount} tables</Badge>
            ) : null}
          </>
        }
      />
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2 md:px-10">
        {v.imageUrl ? (
          <Card className="md:col-span-2 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.imageUrl}
              alt={v.name}
              className="h-64 w-full object-cover"
            />
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <div className="text-xs uppercase text-muted-foreground">
                Address
              </div>
              <div>{v.address}</div>
            </div>
            {v.phone ? (
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Phone
                </div>
                <div>{v.phone}</div>
              </div>
            ) : null}
            {v.email ? (
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Email
                </div>
                <div>{v.email}</div>
              </div>
            ) : null}
            {v.website ? (
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Website
                </div>
                <a
                  href={v.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {v.website}
                </a>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Round-37 — Home teams */}
        <Card data-testid="venue-home-teams">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Home teams</CardTitle>
              <Badge variant="neutral" size="sm">
                {v.homeTeamCount}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {v.homeTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No teams call this venue home yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {v.homeTeams.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/teams/${t.slug}`}
                      className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40"
                    >
                      <Avatar
                        size="md"
                        src={t.logoUrl ?? undefined}
                        fallback={t.name}
                        shape="team"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {t.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Captain {t.captain.name} · {t.members.length} members
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
