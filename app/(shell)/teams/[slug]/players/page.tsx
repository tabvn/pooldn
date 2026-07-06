import { TeamPlayers } from "./players-client";

export default async function TeamPlayersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Round-66 — the Players tab now also hosts the (former) Manage Players
  // controls; the component gates them client-side on the viewer.
  return <TeamPlayers slug={slug} />;
}
