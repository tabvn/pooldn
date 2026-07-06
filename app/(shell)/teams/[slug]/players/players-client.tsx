"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { InvitePicker } from "@/components/team/invite-picker";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";
import { RemoveTeamMemberMutation } from "@/lib/graphql/operations/team-mutations.operations";
import {
  CancelTeamInvitationMutation,
  InviteToTeamMutation,
  ReviewJoinRequestMutation,
  TeamInvitationsQuery,
  TeamJoinRequestsQuery,
  TransferCaptaincyMutation,
} from "@/lib/graphql/operations/team-collab.operations";

/**
 * Round-66 — the Players tab now also carries the (formerly separate) Manage
 * Players screen. Everyone sees the roster; the captain/admin additionally
 * gets the remove/transfer controls, the invite card, and join requests —
 * all gated client-side on the viewer.
 */
export function TeamPlayers({ slug }: { slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const teamQuery = useQuery(TeamDetailQuery, { variables: { slug } });
  const viewerQuery = useQuery(ViewerQuery, { errorPolicy: "ignore" });
  const team = teamQuery.data?.team;
  const viewer = viewerQuery.data?.viewer;

  const canManage =
    !!viewer &&
    !!team &&
    (viewer.role === "SUPER_ADMIN" || viewer.id === team.captain.id);

  const teamIdForQueries = team?.id ?? "";
  const invitesQuery = useQuery(TeamInvitationsQuery, {
    variables: { teamId: teamIdForQueries },
    skip: !teamIdForQueries || !canManage,
    fetchPolicy: "cache-and-network",
  });
  const joinReqQuery = useQuery(TeamJoinRequestsQuery, {
    variables: { teamId: teamIdForQueries },
    skip: !teamIdForQueries || !canManage,
    fetchPolicy: "cache-and-network",
  });

  const [remove, removeState] = useMutation(RemoveTeamMemberMutation);
  const [invite, inviteState] = useMutation(InviteToTeamMutation);
  const [cancelInvite] = useMutation(CancelTeamInvitationMutation);
  const [reviewJoin, reviewJoinState] = useMutation(ReviewJoinRequestMutation);
  const [transferCaptaincy, transferState] = useMutation(TransferCaptaincyMutation);

  const excludeIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of team?.members ?? []) {
      if (m.user?.id) s.add(m.user.id);
    }
    for (const inv of invitesQuery.data?.teamInvitations ?? []) {
      if (inv.invitedUser?.id) s.add(inv.invitedUser.id);
    }
    return s;
  }, [team?.members, invitesQuery.data?.teamInvitations]);

  if (!team) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  const teamId = team.id;
  const captainId = team.captain.id;

  async function onRemove(userId: string, name: string) {
    const ok = await confirm({
      title: `Remove ${name}?`,
      description: "They'll be dropped from the team immediately.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    await remove({ variables: { teamId, userId } });
    toast.success(`${name} removed`);
    await teamQuery.refetch();
    router.refresh();
  }

  async function onInviteUser(
    input:
      | { kind: "user"; userId: string; label: string }
      | { kind: "email"; email: string },
  ): Promise<boolean> {
    try {
      await invite({
        variables: {
          teamId,
          userId: input.kind === "user" ? input.userId : null,
          username: null,
          email: input.kind === "email" ? input.email : null,
        },
      });
      toast.success(
        "Invitation sent",
        input.kind === "user"
          ? `Invited ${input.label}.`
          : `Invited ${input.email} by email.`,
      );
      await invitesQuery.refetch();
      return true;
    } catch (e) {
      toast.error("Could not send invite", e);
      return false;
    }
  }

  async function onCancelInvite(id: string) {
    const ok = await confirm({
      title: "Cancel this invitation?",
      description: "The invitee will no longer see it in their invitations.",
      confirmLabel: "Cancel invitation",
      destructive: true,
    });
    if (!ok) return;
    await cancelInvite({ variables: { id } });
    toast.success("Invitation cancelled");
    await invitesQuery.refetch();
  }

  async function onReviewJoin(id: string, approve: boolean, name: string) {
    await reviewJoin({ variables: { id, approve } });
    toast.success(approve ? `${name} added` : `Declined ${name}`);
    await Promise.all([joinReqQuery.refetch(), teamQuery.refetch()]);
    router.refresh();
  }

  async function onTransferCaptaincy(userId: string, name: string) {
    const ok = await confirm({
      title: `Transfer captaincy to ${name}?`,
      description:
        "You'll stop being the team captain. You can stay on the team as a regular member.",
      confirmLabel: "Transfer captaincy",
      destructive: true,
    });
    if (!ok) return;
    try {
      await transferCaptaincy({
        variables: { teamId, newCaptainUserId: userId },
      });
      toast.success(`${name} is now the captain`);
      await teamQuery.refetch();
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not transfer captaincy",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <Card data-testid="team-players">
        <CardHeader>
          <CardTitle>Players · {team.members.length}</CardTitle>
        </CardHeader>
        <CardContent
          className={
            canManage
              ? "space-y-2"
              : "grid grid-cols-1 gap-3 md:grid-cols-2"
          }
        >
          {team.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            team.members.map((m) => {
              const isCaptain = m.user.id === captainId;
              if (!canManage) {
                return (
                  <Link
                    key={m.id}
                    href={`/players/${m.user.username}`}
                    className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 transition-colors hover:border-primary/40"
                  >
                    <Avatar
                      size="md"
                      src={m.user.avatarUrl ?? undefined}
                      fallback={m.user.name}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-semibold">
                        {m.user.name}
                        <CountryFlag
                          code={m.user.nationality}
                          className="text-base leading-none"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        @{m.user.username}
                      </div>
                    </div>
                    {isCaptain ? (
                      <Badge variant="primary" size="sm">
                        Captain
                      </Badge>
                    ) : null}
                  </Link>
                );
              }
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                >
                  <Link href={`/players/${m.user.username}`} className="shrink-0">
                    <Avatar
                      size="md"
                      src={m.user.avatarUrl ?? undefined}
                      fallback={m.user.name}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/players/${m.user.username}`}
                      className="font-semibold hover:underline"
                    >
                      {m.user.name}
                      <CountryFlag
                        code={m.user.nationality}
                        className="ml-1.5 leading-none"
                      />
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      @{m.user.username}
                    </div>
                  </div>
                  {isCaptain ? (
                    <Badge variant="primary" size="sm">
                      Captain
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={transferState.loading}
                        onClick={() =>
                          onTransferCaptaincy(m.user.id, m.user.name)
                        }
                        data-testid={`transfer-captaincy-${m.user.id}`}
                      >
                        Make captain
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        loading={removeState.loading}
                        onClick={() => onRemove(m.user.id, m.user.name)}
                        aria-label={`Remove ${m.user.name}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <>
          <Card data-testid="invite-card">
            <CardHeader>
              <CardTitle>Invite a player</CardTitle>
              <p className="text-xs text-muted-foreground">
                Search by name or username; or paste an email to invite someone
                new. Current members and existing invitees won&rsquo;t show up.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <InvitePicker
                excludeUserIds={excludeIds}
                loading={inviteState.loading}
                onSubmit={onInviteUser}
              />
              <div>
                <h4 className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pending invitations
                </h4>
                <ul className="space-y-2">
                  {(invitesQuery.data?.teamInvitations ?? []).length === 0 ? (
                    <li className="text-sm text-muted-foreground">
                      No pending invitations.
                    </li>
                  ) : (
                    invitesQuery.data!.teamInvitations.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                        data-testid={`pending-invite-${inv.id}`}
                      >
                        <Avatar
                          size="sm"
                          src={inv.invitedUser?.avatarUrl ?? undefined}
                          fallback={inv.invitedUser?.name ?? inv.email ?? "?"}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {inv.invitedUser?.name ?? inv.email ?? "(unknown)"}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {inv.invitedUser
                              ? `@${inv.invitedUser.username}`
                              : "email invite"}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onCancelInvite(inv.id)}
                        >
                          Cancel
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="join-requests-card">
            <CardHeader>
              <CardTitle>Join requests</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(joinReqQuery.data?.teamJoinRequests ?? []).length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    No pending join requests.
                  </li>
                ) : (
                  joinReqQuery.data!.teamJoinRequests.map((req) => (
                    <li
                      key={req.id}
                      className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                      data-testid={`join-request-${req.id}`}
                    >
                      <Avatar
                        size="sm"
                        src={req.user.avatarUrl ?? undefined}
                        fallback={req.user.name}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {req.user.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          @{req.user.username}
                          {req.message ? ` · "${req.message}"` : ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        loading={reviewJoinState.loading}
                        onClick={() => onReviewJoin(req.id, true, req.user.name)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onReviewJoin(req.id, false, req.user.name)}
                      >
                        Decline
                      </Button>
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
