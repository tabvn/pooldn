import { MatchFlow } from "./match-flow";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Guests can view match details for public competitions — MatchFlow renders
  // read-only and the match query enforces competition visibility. Captain /
  // admin actions inside are gated on the signed-in viewer.
  return <MatchFlow id={id} />;
}
