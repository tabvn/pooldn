import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-title";
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
      <PageTitle
        title={v.name}
        eyebrow={<span>Venue</span>}
        actions={
          canEdit ? (
            <Link href={`/venues/${slug}/edit`}>
              <Button variant="outline">Edit venue</Button>
            </Link>
          ) : null
        }
        meta={
          <>
            <span>{v.city.name}</span>
            {v.tableCount ? (
              <Badge variant="primary">{v.tableCount} tables</Badge>
            ) : null}
          </>
        }
      />
      <div className="p-8 grid grid-cols-1 gap-4 md:grid-cols-2">
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
      </div>
    </div>
  );
}
