import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getClient } from "@/lib/apollo/client";
import { TeamsListQuery } from "@/lib/graphql/operations/team.operations";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import { MyTeamsBand } from "@/components/team/my-teams-band";
import { getHeaderCityId } from "@/lib/headers/city";
import { TeamsBrowse } from "./browse";

export default async function TeamsPage() {
  const client = getClient();
  const cityId = await getHeaderCityId();
  const [{ data }, viewerResult] = await Promise.all([
    client.query({
      query: TeamsListQuery,
      variables: { cityId: cityId ?? undefined },
    }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
  ]);
  const teams = data?.teams ?? [];
  const viewer = viewerResult.data?.viewer;
  // Round-30 — any signed-in non-VIEWER can create a team (becomes captain).
  const canCreate = !!viewer && viewer.role !== "VIEWER";

  return (
    <div className="p-4 md:p-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">Teams</h1>
          <p className="text-sm text-muted-foreground">
            All active teams on PoolDN.
          </p>
        </div>
        {canCreate ? (
          <Link href="/teams/new">
            <Button>Create team</Button>
          </Link>
        ) : null}
      </header>

      {viewer ? <MyTeamsBand /> : null}

      <TeamsBrowse
        teams={teams.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          logoUrl: t.logoUrl ?? null,
          isActive: t.isActive,
          memberCount: t.members.length,
          captain: t.captain,
        }))}
        viewerId={viewer?.id ?? null}
        canCreate={canCreate}
      />
    </div>
  );
}
