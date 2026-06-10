"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-title";
import { CompetitionInviteActions } from "@/components/competition/competition-invite-actions";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  CancelJoinRequestMutation,
  MyInvitationsInboxQuery,
  MyJoinRequestsQuery,
  RespondToInvitationMutation,
} from "@/lib/graphql/operations/team-collab.operations";

export function InvitationsList() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, refetch } = useQuery(MyInvitationsInboxQuery, {
    fetchPolicy: "cache-and-network",
  });
  const [respond, { loading: responding }] = useMutation(
    RespondToInvitationMutation,
  );
  const joinRequestsQ = useQuery(MyJoinRequestsQuery, {
    fetchPolicy: "cache-and-network",
  });
  const [cancelJoin, { loading: cancelling }] = useMutation(
    CancelJoinRequestMutation,
  );

  const [dismissedCompInvites, setDismissedCompInvites] = useState<Set<string>>(
    new Set(),
  );

  async function onRespond(id: string, accept: boolean, teamName: string) {
    try {
      await respond({ variables: { id, accept } });
      toast.success(accept ? `Joined ${teamName}` : `Declined ${teamName}`);
      await refetch();
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not respond",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  async function onCancelJoin(id: string, teamName: string) {
    const ok = await confirm({
      title: `Withdraw your request?`,
      description: `Your join request to ${teamName} will be cancelled.`,
      confirmLabel: "Withdraw",
      destructive: true,
    });
    if (!ok) return;
    await cancelJoin({ variables: { id } });
    toast.success(`Withdrew request to ${teamName}`);
    await joinRequestsQ.refetch();
    router.refresh();
  }

  const teamInvitations = data?.myTeamInvitations ?? [];
  const competitionInvites = (data?.myCompetitionInvitations ?? []).filter(
    (i) => !dismissedCompInvites.has(i.id),
  );
  const myJoinRequests = joinRequestsQ.data?.myJoinRequests ?? [];
  const totalPending = teamInvitations.length + competitionInvites.length;

  return (
    <div className="flex flex-col">
      <PageTitle
        title="Invitations"
        eyebrow={<span>Inbox</span>}
        meta={
          <Badge variant="neutral" size="sm">
            {totalPending} pending
          </Badge>
        }
      />
      <div className="p-8 max-w-2xl space-y-6">
        {/* Round-49 — competition invites surface first since they're the
            time-sensitive ones (organizer is waiting on the captain). */}
        {competitionInvites.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Competition invitations
            </h2>
            {competitionInvites.map((inv) => (
              <Card
                key={inv.id}
                data-testid={`competition-invitation-${inv.id}`}
              >
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                  <Avatar
                    size="lg"
                    src={inv.competition.bannerUrl ?? undefined}
                    fallback={inv.competition.name}
                    shape="team"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/competitions/${inv.competition.slug}`}
                      className="text-sm font-semibold hover:underline"
                    >
                      {inv.competition.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      As{" "}
                      <Link
                        href={`/teams/${inv.team.slug}`}
                        className="hover:underline"
                      >
                        {inv.team.name}
                      </Link>
                      {" · "}
                      Organizer: {inv.competition.organizer.name}
                    </div>
                    {inv.message ? (
                      <div className="mt-1 text-xs italic text-muted-foreground">
                        &ldquo;{inv.message}&rdquo;
                      </div>
                    ) : null}
                  </div>
                  <CompetitionInviteActions
                    applicationId={inv.id}
                    competitionSlug={inv.competition.slug}
                    teamId={inv.team.id}
                    teamName={inv.team.name}
                    onDeclined={() =>
                      setDismissedCompInvites((s) =>
                        new Set(s).add(inv.id),
                      )
                    }
                  />
                </CardContent>
              </Card>
            ))}
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Team invitations
          </h2>
          {loading && teamInvitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : teamInvitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            teamInvitations.map((inv) => (
              <Card key={inv.id} data-testid={`invitation-${inv.id}`}>
                <CardContent className="flex items-center gap-3 py-4">
                  <Avatar
                    size="lg"
                    src={inv.team.logoUrl ?? undefined}
                    fallback={inv.team.name}
                  />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/teams/${inv.team.slug}`}
                      className="text-sm font-semibold hover:underline"
                    >
                      {inv.team.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      Invited by {inv.invitedBy.name} (@{inv.invitedBy.username})
                    </div>
                    {inv.message ? (
                      <div className="mt-1 text-xs italic text-muted-foreground">
                        &ldquo;{inv.message}&rdquo;
                      </div>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    loading={responding}
                    onClick={() => onRespond(inv.id, true, inv.team.name)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRespond(inv.id, false, inv.team.name)}
                  >
                    Decline
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        {myJoinRequests.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Your pending join requests
            </h2>
            {myJoinRequests.map((req) => (
              <Card
                key={req.id}
                data-testid={`my-join-request-${req.id}`}
              >
                <CardContent className="flex items-center gap-3 py-4">
                  <Avatar
                    size="md"
                    src={req.team.logoUrl ?? undefined}
                    fallback={req.team.name}
                  />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/teams/${req.team.slug}`}
                      className="text-sm font-semibold hover:underline"
                    >
                      {req.team.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      Sent {new Date(req.createdAt).toLocaleDateString()}
                    </div>
                    {req.message ? (
                      <div className="mt-1 text-xs italic text-muted-foreground">
                        &ldquo;{req.message}&rdquo;
                      </div>
                    ) : null}
                  </div>
                  <Badge variant="neutral" size="sm">
                    Pending
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={cancelling}
                    onClick={() => onCancelJoin(req.id, req.team.name)}
                  >
                    Withdraw
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
