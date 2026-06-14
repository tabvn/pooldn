import { notFound } from "next/navigation";
import { getClient } from "@/lib/apollo/client";
import {
  CompetitionHeaderQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";
import { ApplicationsList } from "./list";

/**
 * Round-60 — Applications is the lead tab for an upcoming competition, so
 * it's viewable by everyone (not just the organizer): non-managers see the
 * read-only Confirmed Teams list, managers get the full review/invite
 * tables. Management actions are gated inside ApplicationsList by the
 * `canManage` flag computed here.
 */
export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = getClient();
  const [{ data }, viewerResult] = await Promise.all([
    client.query({ query: CompetitionHeaderQuery, variables: { slug } }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
  ]);
  const c = data?.competition;
  if (!c) notFound();
  const viewer = viewerResult.data?.viewer ?? null;
  const canManage =
    !!viewer &&
    (viewer.role === "SUPER_ADMIN" || viewer.id === c.organizer.id);
  return <ApplicationsList slug={slug} canManage={canManage} />;
}
