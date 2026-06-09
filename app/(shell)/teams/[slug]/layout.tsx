import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BanTeamButton } from "@/components/admin/ban-team-button";
import { FollowButton } from "@/components/follow-button";
import { PageTitle } from "@/components/layout/page-title";
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
      <PageTitle
        title={team.name}
        eyebrow={
          <span className="flex items-center gap-3">
            <Avatar
              size="sm"
              src={team.logoUrl ?? undefined}
              fallback={team.name}
              shape="team"
            />
            Team
          </span>
        }
        description={team.description}
        actions={
          <div className="flex items-center gap-2">
            <FollowButton
              entityType="TEAM"
              entityId={team.id}
              isFollowing={team.isFollowing}
              followerCount={team.followerCount}
              followersHref={`/teams/${slug}/followers`}
              signedIn={!!viewer}
            />
            {canManage ? (
              <>
                <Link href={`/teams/${slug}/manage`}>
                  <Button variant="outline">Manage roster</Button>
                </Link>
                <Link href={`/teams/${slug}/edit`}>
                  <Button variant="outline">Edit team</Button>
                </Link>
              </>
            ) : null}
            {canRequestToJoin ? (
              <JoinTeamButton teamId={team.id} teamName={team.name} />
            ) : null}
            {isMember && !isCaptain ? (
              <LeaveTeamButton teamId={team.id} teamName={team.name} />
            ) : null}
            {isAdmin ? (
              <BanTeamButton
                teamId={team.id}
                teamName={team.name}
                bannedAt={team.bannedAt ?? null}
              />
            ) : null}
          </div>
        }
        meta={
          <>
            <span>Captain: {team.captain.name}</span>
            <Badge variant="primary">
              {team.members.length}{" "}
              {team.members.length === 1 ? "member" : "members"}
            </Badge>
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
      <div className="px-8 pt-6">
        <TabNav items={tabs} />
      </div>
      {team.myInvitation ? (
        <InviteBanner
          invitation={team.myInvitation}
          team={{ name: team.name, logoUrl: team.logoUrl ?? null }}
        />
      ) : null}
      <div className="px-4 md:px-8 py-6">{children}</div>
    </div>
  );
}
