import { redirect } from "next/navigation";

/**
 * Round-65 — the About tab was merged into Overview. Redirect any lingering
 * /teams/[slug]/about links to the team overview.
 */
export default async function TeamAboutRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/teams/${slug}`);
}
