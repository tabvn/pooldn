"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-title";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { InvitePicker } from "@/components/team/invite-picker";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";
import {
  RemoveTeamMemberMutation,
} from "@/lib/graphql/operations/team-mutations.operations";
import {
  CancelTeamInvitationMutation,
  InviteToTeamMutation,
  ReviewJoinRequestMutation,
  TeamInvitationsQuery,
  TeamJoinRequestsQuery,
  TransferCaptaincyMutation,
} from "@/lib/graphql/operations/team-collab.operations";

export function ManageRoster({ slug }: { slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const teamQuery = useQuery(TeamDetailQuery, { variables: { slug } });
  const [remove, removeState] = useMutation(RemoveTeamMemberMutation);
  const teamIdForQueries = teamQuery.data?.team?.id ?? "";
  const invitesQuery = useQuery(TeamInvitationsQuery, {
    variables: { teamId: teamIdForQueries },
    skip: !teamIdForQueries,
    fetchPolicy: "cache-and-network",
  });
  const joinReqQuery = useQuery(TeamJoinRequestsQuery, {
    variables: { teamId: teamIdForQueries },
    skip: !teamIdForQueries,
    fetchPolicy: "cache-and-network",
  });
  const [invite, inviteState] = useMutation(InviteToTeamMutation);
  const [cancelInvite] = useMutation(CancelTeamInvitationMutation);
  const [reviewJoin, reviewJoinState] = useMutation(ReviewJoinRequestMutation);
  const [transferCaptaincy, transferState] = useMutation(TransferCaptaincyMutation);
  const team = teamQuery.data?.team;

  // R45+ — feed the invite picker a set of user-ids it should skip:
  //   - everyone already on the active roster (so we can't double-add)
  //   - everyone with a PENDING invitation
  //   - the viewer themselves (server enforces "no self-invite" anyway)
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
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  const teamId = team.id;
  const captainId = team.captain.id;

  async function onRemove(userId: string, name: string) {
    const ok = await confirm({
      title: `Remove ${name}?`,
      description: "They'll be dropped from the roster immediately.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    await remove({ variables: { teamId, userId } });
    toast.success(`${name} removed`);
    await teamQuery.refetch();
    router.refresh();
  }

  async function onInviteUser(input:
    | { kind: "user"; userId: string; label: string }
    | { kind: "email"; email: string }): Promise<boolean> {
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
        "You'll stop being the team captain. You can stay on the roster as a regular member.",
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
    <div className="flex flex-col">
      <PageTitle
        title={team.name}
        eyebrow={<span>Manage roster</span>}
        meta={
          <Badge variant="primary">
            {team.members.length}{" "}
            {team.members.length === 1 ? "member" : "members"}
          </Badge>
        }
      />
      <div className="p-8 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Current roster</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {team.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No members yet — add some below.
              </p>
            ) : (
              team.members.map((m) => {
                const isCaptain = m.user.id === captainId;
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <Avatar
                      size="md"
                      src={m.user.avatarUrl ?? undefined}
                      fallback={m.user.name}
                    />
                    <div className="flex-1">
                      <div className="font-semibold">{m.user.name}</div>
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

        <Card data-testid="invite-card">
          <CardHeader>
            <CardTitle>Invite a player</CardTitle>
            <p className="text-xs text-muted-foreground">
              Search by name or username; or paste an email to invite someone
              new. Current members and existing invitees won't show up.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <InvitePicker
              excludeUserIds={excludeIds}
              loading={inviteState.loading}
              onSubmit={onInviteUser}
            />
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2 mb-2">
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
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {inv.invitedUser?.name ?? inv.email ?? "(unknown)"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
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
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {req.user.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
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
                      onClick={() =>
                        onReviewJoin(req.id, false, req.user.name)
                      }
                    >
                      Decline
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Round-28 — captain can ONLY add via invitations or by approving
            join requests. No direct-add UI; addTeamMember is admin/seed-only. */}
      </div>
    </div>
  );
}
