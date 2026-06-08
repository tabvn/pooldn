import { requireViewer } from "@/lib/auth/server";
import { MatchFlow } from "./match-flow";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireViewer({ next: `/matches/${id}` });
  return <MatchFlow id={id} />;
}
