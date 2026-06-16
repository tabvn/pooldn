import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { TeamActionsMenu } from "@/components/team/team-actions-menu";
import { FollowButton } from "@/components/follow-button";
import { DetailHero } from "@/components/layout/detail-hero";
import { TabNav } from "@/components/layout/tab-nav";
import { InviteBanner } from "@/components/team/invite-banner";
import { JoinTeamButton } from "@/components/team/join-team-button";
import { LeaveTeamButton } from "@/components/team/leave-team-button";
import { getClient } from "@/lib/apollo/client";
import { getViewer } from "@/lib/auth/server";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";

export default async function TeamLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: ReactNode;
}) {
  const { slug } = await params;
  const [{ data }, viewer] = await Promise.all([
    getClient().query({ query: TeamDetailQuery, variables: { slug } }),
    getViewer(),
  ]);
  const team = data?.team;
  if (!team) notFound();
  const isAdmin = viewer?.role === "SUPER_ADMIN";
  const isCaptain = viewer?.id === team.captain.id;
  const canManage = isAdmin || isCaptain;
  const isMember = team.members.some((m) => m.user.id === viewer?.id);
  const canRequestToJoin = !!viewer && !isMember && !isCaptain;

  const tabs = [
    { href: `/teams/${slug}`, label: "Overview" },
    { href: `/teams/${slug}/roster`, label: "Roster" },
    { href: `/teams/${slug}/competitions`, label: "Competitions" },
    { href: `/teams/${slug}/matches`, label: "Matches" },
    { href: `/teams/${slug}/about`, label: "About" },
  ];

  return (
    <div className="flex flex-col">
      <DetailHero
        title={team.name}
        media={
          <Avatar
            size="lg"
            src={team.logoUrl ?? undefined}
            fallback={team.name}
            shape="team"
          />
        }
        actions={
          <>
            <FollowButton
              entityType="TEAM"
              entityId={team.id}
              isFollowing={team.isFollowing}
              followerCount={team.followerCount}
              followersHref={`/teams/${slug}/followers`}
              signedIn={!!viewer}
            />
            {canRequestToJoin ? (
              <JoinTeamButton teamId={team.id} teamName={team.name} />
            ) : null}
            {isMember && !isCaptain ? (
              <LeaveTeamButton teamId={team.id} teamName={team.name} />
            ) : null}
            <TeamActionsMenu
              teamId={team.id}
              teamSlug={slug}
              teamName={team.name}
              bannedAt={team.bannedAt ?? null}
              isCaptain={isCaptain}
              isAdmin={isAdmin}
            />
          </>
        }
        meta={
          <>
            <span className="inline-flex items-center rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              Team
            </span>
            <span>Captain: {team.captain.name}</span>
            <Badge variant="primary">
              {team.members.length}{" "}
              {team.members.length === 1 ? "member" : "members"}
            </Badge>
            <span data-testid="team-created-at">
              Created <RelativeTime value={team.createdAt} />
            </span>
            {!team.isActive ? (
              <Badge variant="neutral">inactive</Badge>
            ) : null}
            {team.bannedAt ? (
              <Badge variant="danger" data-testid="team-banned-badge">
                Banned
              </Badge>
            ) : null}
          </>
        }
      />
      <div className="mx-auto w-full max-w-5xl px-6 pt-6 md:px-10">
        <TabNav items={tabs} fullWidth />
      </div>
      {team.myInvitation ? (
        <div className="mx-auto w-full max-w-5xl px-6 pt-4 md:px-10">
          <InviteBanner
            invitation={team.myInvitation}
            team={{ name: team.name, logoUrl: team.logoUrl ?? null }}
          />
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-5xl px-6 py-6 md:px-10">
        {children}
      </div>
    </div>
  );
}
