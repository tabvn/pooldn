import { notFound, redirect } from "next/navigation";
import { getClient } from "@/lib/apollo/client";
import { getViewer } from "@/lib/auth/server";
import { CompetitionHeaderQuery } from "@/lib/graphql/operations/competition.operations";
import { ClaimReviewList } from "@/components/shell/claim-review-list";

/**
 * Round-88 — the organizer's claim queue for ONE competition: the players in
 * it who are still placeholders, and the people saying "that's me".
 *
 * Organizer/admin only — the tab isn't rendered for anyone else (see the
 * competition layout), and this page redirects rather than rendering an empty
 * queue if someone types the URL.
 */
export default async function CompetitionClaimsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ data }, viewer] = await Promise.all([
    getClient().query({ query: CompetitionHeaderQuery, variables: { slug } }),
    getViewer(),
  ]);
  const c = data?.competition;
  if (!c) notFound();
  const canManage =
    !!viewer &&
    (viewer.role === "SUPER_ADMIN" || viewer.id === c.organizer.id);
  if (!canManage) redirect(`/competitions/${slug}`);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Profile claims</h2>
        <p className="text-sm text-muted-foreground">
          Players asking to take over a placeholder profile in {c.name}.
          Approving hands them every match, frame and stat recorded under that
          name — check they really are who they say before you do.
        </p>
      </div>
      <ClaimReviewList
        competitionId={c.id}
        emptyHint={`Nobody has asked to claim a placeholder in ${c.name} yet.`}
      />
    </div>
  );
}
