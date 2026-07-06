import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/server";
import { getClient } from "@/lib/apollo/client";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";
import { EditTeamForm } from "./form";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await requireViewer({ next: `/teams/${slug}/edit` });
  const { data } = await getClient().query({
    query: TeamDetailQuery,
    variables: { slug },
  });
  const team = data?.team;
  if (!team) notFound();
  const isAdmin = viewer.role === "SUPER_ADMIN";
  const isCaptain = viewer.id === team.captain.id;
  if (!isAdmin && !isCaptain) {
    redirect(`/teams/${slug}`);
  }
  return (
    <EditTeamForm
      initial={{
        id: team.id,
        slug: team.slug,
        name: team.name,
        description: team.description,
        logoUrl: team.logoUrl,
        homeVenue: team.homeVenue
          ? {
              id: team.homeVenue.id,
              name: team.homeVenue.name,
              city: { name: team.homeVenue.city.name },
            }
          : null,
      }}
    />
  );
}
