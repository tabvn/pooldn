import { requireViewer } from "@/lib/auth/server";
import { getClient } from "@/lib/apollo/client";
import { CompetitionHeaderQuery } from "@/lib/graphql/operations/competition.operations";
import { ApplyForm } from "./form";
import { SoloApplyForm } from "./solo-apply-form";

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ teamId?: string }>;
}) {
  const { slug } = await params;
  const { teamId } = await searchParams;
  // Round-30 — captaincy is per-team (team.captainId), so PLAYERs who own a
  // team can apply with it; applyToCompetition enforces the captain check.
  await requireViewer({
    next: `/competitions/${slug}/apply`,
    roles: ["PLAYER", "TEAM_CAPTAIN", "SUPER_ADMIN"],
  });
  // Round-53 — INDIVIDUAL (Singles) competitions use a solo apply form;
  // TEAMS and DOUBLES share the team-based wizard. Read the type up front
  // so the right form renders without a client-side flash.
  const { data } = await getClient().query({
    query: CompetitionHeaderQuery,
    variables: { slug },
  });
  const type = data?.competition?.type ?? "TEAMS";
  if (type === "INDIVIDUAL") {
    return <SoloApplyForm slug={slug} />;
  }
  return <ApplyForm slug={slug} initialTeamId={teamId ?? null} />;
}
