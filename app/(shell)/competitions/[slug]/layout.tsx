import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/follow-button";
import { ApplyCta } from "@/components/competition/apply-cta";
import { LifecycleActions } from "@/components/competition/lifecycle-actions";
import { MetaChips } from "@/components/competition/meta-chips";
import { PageTitle } from "@/components/layout/page-title";
import { TabNav } from "@/components/layout/tab-nav";
import { getClient } from "@/lib/apollo/client";
import { CompetitionHeaderQuery, ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import { competitionStatusLabel } from "@/components/ui/status-chip";


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

  const tabs: Array<{ href: string; label: string; badge?: number | null }> = [
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
      // Round-50 — surface pending review items (PENDING applications +
      // PENDING RosterChangeRequests). Only rendered for org/admin since
      // the Applications tab itself is gated on canManage.
      badge: c.pendingReviewCount > 0 ? c.pendingReviewCount : null,
    });
  }
  // Round-48 (wizard) — single source of truth for "should the apply CTA
  // render?". Server-computed on Competition.viewerCanApply, which returns
  // true iff viewer is signed in (not VIEWER), status is OPEN_FOR_APPLICATIONS,
  // AND (applicationMode is OPEN OR viewer captains a team on the INVITE_ONLY
  // list). The applyToCompetition mutation enforces the same rule, so the
  // gate and the action can't drift.
  const canApply = c.viewerCanApply;
  const isOpen = c.status === "OPEN_FOR_APPLICATIONS";
  const isInviteOnly = c.applicationMode === "INVITE_ONLY";

  return (
    <div className="flex flex-col">
      <PageTitle
        title={c.name}
        bannerUrl={c.bannerUrl}
        eyebrow={
          <span>
            Competition · {competitionStatusLabel[c.status] ?? c.status}
          </span>
        }
        description={c.description}
        actions={
          <div className="flex items-center gap-2">
            <FollowButton
              entityType="COMPETITION"
              entityId={c.id}
              isFollowing={c.isFollowing}
              followerCount={c.followerCount}
              followersHref={`/competitions/${slug}/followers`}
              signedIn={!!viewer}
            />
            {canManage ? (
              <LifecycleActions
                competitionId={c.id}
                competitionSlug={c.slug}
                status={c.status}
              />
            ) : canApply ? (
              <ApplyCta
                competitionSlug={c.slug}
                myApplication={c.myTeamApplication ?? null}
              />
            ) : !viewer && isOpen ? (
              <Link href={`/sign-in?next=/competitions/${slug}/apply`}>
                <Button>Sign in to apply</Button>
              </Link>
            ) : viewer && isOpen && isInviteOnly ? (
              // Signed-in viewer but their team isn't on the invite list.
              // Hide the apply path entirely and explain why — matches the
              // server gate so they can't sneak past via the direct URL.
              <span
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground"
                data-testid="invite-only-badge"
              >
                Invite only
              </span>
            ) : null}
          </div>
        }
        meta={<MetaChips c={c} />}
      />
      <div className="px-8 pt-6">
        <TabNav items={tabs} />
      </div>
      {/* Round-15 — pre-start banner: while the comp is still configurable,
          surface the same wizard for editing right under the tabs. */}
      {canManage &&
      (c.status === "DRAFT" || c.status === "OPEN_FOR_APPLICATIONS") ? (
        <div className="px-8 pt-4">
          <Link
            href={`/competitions/${slug}/edit`}
            className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-sm hover:border-primary/70"
            data-testid="prestart-edit-banner"
          >
            <span>
              <span className="font-semibold">Pre-start setup</span>
              <span className="ml-2 text-xs text-muted-foreground">
                Edit basics, participants, schedule, structure, or rules.
              </span>
            </span>
            <Button size="sm" variant="outline">
              Edit in wizard
            </Button>
          </Link>
        </div>
      ) : null}
      <div className="px-8 py-6">{children}</div>
    </div>
  );
}
