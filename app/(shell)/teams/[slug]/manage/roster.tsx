"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { Mail, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/layout/page-title";
import { useToast } from "@/components/ui/toast";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";
import {
  AddTeamMemberMutation,
  RemoveTeamMemberMutation,
  UsersDirectoryQuery,
} from "@/lib/graphql/operations/team-mutations.operations";
import {
  CancelTeamInvitationMutation,
  InviteToTeamMutation,
  ReviewJoinRequestMutation,
  TeamInvitationsQuery,
  TeamJoinRequestsQuery,
} from "@/lib/graphql/operations/team-collab.operations";

export function ManageRoster({ slug }: { slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const teamQuery = useQuery(TeamDetailQuery, { variables: { slug } });
  const usersQuery = useQuery(UsersDirectoryQuery);
  const [add, addState] = useMutation(AddTeamMemberMutation);
  const [remove, removeState] = useMutation(RemoveTeamMemberMutation);
  const [search, setSearch] = useState("");
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
  const [inviteIdentifier, setInviteIdentifier] = useState("");

  const team = teamQuery.data?.team;
  const users = usersQuery.data?.users ?? [];

  if (!team) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  const teamId = team.id;
  const captainId = team.captain.id;

  const memberIds = new Set(team.members.map((m) => m.user.id));
  const candidates = users.filter(
    (u) =>
      !memberIds.has(u.id) &&
      (search === "" ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase())),
  );

  async function onAdd(userId: string, name: string) {
    await add({ variables: { teamId, userId } });
    toast.success(`${name} added to the roster`);
    await teamQuery.refetch();
    router.refresh();
  }

  async function onRemove(userId: string, name: string) {
    if (!window.confirm(`Remove ${name} from the roster?`)) return;
    await remove({ variables: { teamId, userId } });
    toast.success(`${name} removed`);
    await teamQuery.refetch();
    router.refresh();
  }

  async function onInvite() {
    const id = inviteIdentifier.trim();
    if (!id) return;
    try {
      const isEmail = id.includes("@");
      const isUsername = id.startsWith("@");
      await invite({
        variables: {
          teamId,
          username: isUsername ? id.slice(1) : isEmail ? null : id,
          email: isEmail ? id : null,
        },
      });
      toast.success("Invitation sent");
      setInviteIdentifier("");
      await invitesQuery.refetch();
    } catch (e) {
      toast.error("Could not send invite", e instanceof Error ? e.message : "");
    }
  }

  async function onCancelInvite(id: string) {
    if (!window.confirm("Cancel this pending invitation?")) return;
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
                      <Button
                        size="sm"
                        variant="outline"
                        loading={removeState.loading}
                        onClick={() => onRemove(m.user.id, m.user.name)}
                        aria-label={`Remove ${m.user.name}`}
                      >
                        <X className="size-4" />
                      </Button>
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
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="@username or email"
              value={inviteIdentifier}
              onChange={(e) => setInviteIdentifier(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                loading={inviteState.loading}
                iconBefore={<Mail className="size-4" />}
                onClick={onInvite}
              >
                Send invitation
              </Button>
            </div>
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

        <Card>
          <CardHeader>
            <CardTitle>Add a player directly</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search players by name or username"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {candidates.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  No matching players.
                </li>
              ) : (
                candidates.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <Avatar
                      size="sm"
                      src={u.avatarUrl ?? undefined}
                      fallback={u.name}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        @{u.username}
                        {u.nationality ? ` · ${u.nationality}` : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      iconBefore={<UserPlus className="size-4" />}
                      loading={addState.loading}
                      onClick={() => onAdd(u.id, u.name)}
                    >
                      Add
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
