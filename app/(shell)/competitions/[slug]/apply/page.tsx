import { requireViewer } from "@/lib/auth/server";
import { ApplyForm } from "./form";

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
  // Round-49 — gating now lives inside ApplyForm so the captain sees a
  // clear "why" panel (status not open, already approved, declined) and
  // the deep-link with ?teamId=… from an invite accept can be honoured
  // even when viewerCanApply is currently false (the form surfaces the
  // reason explicitly instead of silently redirecting).
  return <ApplyForm slug={slug} initialTeamId={teamId ?? null} />;
}
