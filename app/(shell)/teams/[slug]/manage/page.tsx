import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/server";
import { getClient } from "@/lib/apollo/client";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";
import { ManageRoster } from "./roster";

export default async function ManageTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await requireViewer({ next: `/teams/${slug}/manage` });
  const { data } = await getClient().query({
    query: TeamDetailQuery,
    variables: { slug },
  });
  const team = data?.team;
  if (!team) notFound();
  if (viewer.role !== "SUPER_ADMIN" && team.captain.id !== viewer.id) {
    redirect(`/teams/${slug}`);
  }
  return <ManageRoster slug={slug} />;
}
