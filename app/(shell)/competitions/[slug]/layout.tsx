import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/follow-button";
import { LifecycleActions } from "@/components/competition/lifecycle-actions";
import { MetaChips } from "@/components/competition/meta-chips";
import { PageTitle } from "@/components/layout/page-title";
import { TabNav } from "@/components/layout/tab-nav";
import { getClient } from "@/lib/apollo/client";
import { CompetitionHeaderQuery, ViewerQuery } from "@/lib/graphql/operations/competition.operations";


export default async function CompetitionLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: ReactNode;
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

  const tabs: Array<{ href: string; label: string }> = [
    { href: `/competitions/${slug}`, label: "Overview" },
    { href: `/competitions/${slug}/matchdays`, label: "Matchdays" },
    { href: `/competitions/${slug}/players`, label: "Players" },
    { href: `/competitions/${slug}/about`, label: "About" },
  ];

  const isAdmin = viewer?.role === "SUPER_ADMIN";
  const ownsThisCompetition =
    !!viewer && viewer.id === c.organizer.id;
  const canManage = isAdmin || ownsThisCompetition;
  if (canManage) {
    tabs.push({
      href: `/competitions/${slug}/applications`,
      label: "Applications",
    });
  }
  const canApply =
    viewer?.role === "TEAM_CAPTAIN" &&
    c.status === "OPEN_FOR_APPLICATIONS";
  const isOpen = c.status === "OPEN_FOR_APPLICATIONS";

  return (
    <div className="flex flex-col">
      <PageTitle
        title={c.name}
        bannerUrl={c.bannerUrl}
        eyebrow={<span>Competition · {c.status.replace(/_/g, " ")}</span>}
        description={c.description}
        actions={
          <div className="flex items-center gap-2">
            <FollowButton
              entityType="COMPETITION"
              entityId={c.id}
              isFollowing={c.isFollowing}
              followerCount={c.followerCount}
              signedIn={!!viewer}
            />
            {canManage ? (
              <LifecycleActions
                competitionId={c.id}
                competitionSlug={c.slug}
                status={c.status}
              />
            ) : canApply ? (
              <Link href={`/competitions/${slug}/apply`}>
                <Button>Apply with my team</Button>
              </Link>
            ) : !viewer && isOpen ? (
              <Link href={`/sign-in?next=/competitions/${slug}/apply`}>
                <Button>Sign in to apply</Button>
              </Link>
            ) : null}
          </div>
        }
        meta={<MetaChips c={c} />}
      />
      <div className="px-8 pt-6">
        <TabNav items={tabs} />
      </div>
      <div className="px-8 py-6">{children}</div>
    </div>
  );
}
