import { requireViewer } from "@/lib/auth/server";
import { ApplyForm } from "./form";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Round-30 — captaincy is per-team (team.captainId), so PLAYERs who own a
  // team can apply with it; applyToCompetition enforces the captain check.
  await requireViewer({
    next: `/competitions/${slug}/apply`,
    roles: ["PLAYER", "TEAM_CAPTAIN", "SUPER_ADMIN"],
  });
  return <ApplyForm slug={slug} />;
}
