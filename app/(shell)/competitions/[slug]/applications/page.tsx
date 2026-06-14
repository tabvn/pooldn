import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/server";
import { getClient } from "@/lib/apollo/client";
import { CompetitionHeaderQuery } from "@/lib/graphql/operations/competition.operations";
import { ApplicationsList } from "./list";

export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Round-60 — manage rights are per-competition (the organizer is whoever
  // created it, regardless of their global role), so gate on ownership +
  // admin rather than the ORGANIZER role. A signed-in non-owner is sent
  // back to the public overview instead of seeing the management table.
  const viewer = await requireViewer({
    next: `/competitions/${slug}/applications`,
  });
  const { data } = await getClient().query({
    query: CompetitionHeaderQuery,
    variables: { slug },
  });
  const c = data?.competition;
  if (!c) notFound();
  const canManage =
    viewer.role === "SUPER_ADMIN" || viewer.id === c.organizer.id;
  if (!canManage) {
    redirect(`/competitions/${slug}`);
  }
  return <ApplicationsList slug={slug} />;
}
