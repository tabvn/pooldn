import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/server";
import { getClient } from "@/lib/apollo/client";
import { CompetitionHeaderQuery } from "@/lib/graphql/operations/competition.operations";
import { ApplyForm } from "./form";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Round-30 — captaincy is per-team (team.captainId), so PLAYERs who own a
  // team can apply with it; applyToCompetition enforces the captain check.
  const viewer = await requireViewer({
    next: `/competitions/${slug}/apply`,
    roles: ["PLAYER", "TEAM_CAPTAIN", "SUPER_ADMIN"],
  });
  // Round-48 (wizard) — hard-block direct navigation when the viewer can't
  // apply: not-OPEN, INVITE_ONLY and not on the invite list, etc. Admins
  // bypass so they can still help correct state. The mutation also
  // enforces this, but the UI shouldn't let users fill in a form they
  // can't submit.
  if (viewer.role !== "SUPER_ADMIN") {
    const { data } = await getClient().query({
      query: CompetitionHeaderQuery,
      variables: { slug },
    });
    if (data?.competition && !data.competition.viewerCanApply) {
      redirect(`/competitions/${slug}`);
    }
  }
  return <ApplyForm slug={slug} />;
}
