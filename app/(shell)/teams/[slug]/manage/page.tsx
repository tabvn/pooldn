import { redirect } from "next/navigation";

/**
 * Round-66 — Manage Players was merged into the Players tab. Redirect any
 * lingering /teams/[slug]/manage links there.
 */
export default async function ManageRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/teams/${slug}/players`);
}
