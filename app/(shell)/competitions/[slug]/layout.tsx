import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ApplyCta } from "@/components/competition/apply-cta";
import { LifecycleActions } from "@/components/competition/lifecycle-actions";
import { CompetitionHero } from "@/components/competition/competition-hero";
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

  const isAdmin = viewer?.role === "SUPER_ADMIN";
  const ownsThisCompetition =
    !!viewer && viewer.id === c.organizer.id;
  const canManage = isAdmin || ownsThisCompetition;

  // Round-60 — tab set depends on lifecycle stage:
  //   • Upcoming (Accepting / Applications-closed) → Applications ·
  //     Matchdays · Players · About. Standings don't exist yet so the
  //     Figma pre-start screen leads with Applications. The bare
  //     /competitions/[slug] URL lands everyone on Applications
  //     (handled in page.tsx). Non-managers see the read-only confirmed-
  //     teams view there.
  //   • Active / Completed → Overview · Matchdays · Players · About.
  const preStart =
    c.status === "OPEN_FOR_APPLICATIONS" ||
    c.status === "APPLICATIONS_CLOSED";
  const secondaryTabs = [
    { href: `/competitions/${slug}/matchdays`, label: "Matchdays" },
    { href: `/competitions/${slug}/players`, label: "Players" },
    { href: `/competitions/${slug}/about`, label: "About" },
  ];
  const tabs: Array<{ href: string; label: string; badge?: number | null }> =
    preStart
      ? [
          {
            href: `/competitions/${slug}/applications`,
            label: "Applications",
            // Pending-review badge only matters to the organizer.
            badge:
              canManage && c.pendingReviewCount > 0
                ? c.pendingReviewCount
                : null,
          },
          ...secondaryTabs,
        ]
      : [
          { href: `/competitions/${slug}`, label: "Overview" },
          ...secondaryTabs,
        ];
  // Round-48 (wizard) — single source of truth for "should the apply CTA
  // render?". Server-computed on Competition.viewerCanApply, which returns
  // true iff viewer is signed in (not VIEWER), status is OPEN_FOR_APPLICATIONS,
  // AND (applicationMode is OPEN OR viewer captains a team on the INVITE_ONLY
  // list). The applyToCompetition mutation enforces the same rule, so the
  // gate and the action can't drift.
  const canApply = c.viewerCanApply;
  const isOpen = c.status === "OPEN_FOR_APPLICATIONS";
  const isInviteOnly = c.applicationMode === "INVITE_ONLY";

  // Round-55 — DRAFT competitions have no public lifecycle yet (no
  // matchdays, players or About content worth rendering), so the
  // organizer-only edit screen owns the full viewport. The layout drops
  // its PageTitle + TabNav + pre-start CTA for that state — the Figma
  // draft screen has its own hero + 4-tab editor inside the page.
  if (c.status === "DRAFT") {
    return <div className="flex flex-col">{children}</div>;
  }

  return (
    <div className="flex flex-col">
      <CompetitionHero
        competition={c}
        actions={
          <>
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
          </>
        }
      />
      <div className="mx-auto w-full max-w-5xl px-6 pt-6 md:px-10">
        <TabNav items={tabs} fullWidth />
      </div>
      {/* Round-60 — the "pre-start setup / edit in wizard" banner was
          removed from the published detail screen at the user's request.
          DRAFT comps still own the full editor; organizers manage a
          published comp through the lifecycle actions in the hero. */}
      <div className="mx-auto w-full max-w-5xl px-6 py-6 md:px-10">
        {children}
      </div>
    </div>
  );
}
