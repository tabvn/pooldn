"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-title";
import { useToast } from "@/components/ui/toast";
import {
  MyTeamInvitationsQuery,
  RespondToInvitationMutation,
} from "@/lib/graphql/operations/team-collab.operations";

export function InvitationsList() {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, refetch } = useQuery(MyTeamInvitationsQuery, {
    fetchPolicy: "cache-and-network",
  });
  const [respond, { loading: responding }] = useMutation(
    RespondToInvitationMutation,
  );

  async function onRespond(id: string, accept: boolean, teamName: string) {
    await respond({ variables: { id, accept } });
    toast.success(accept ? `Joined ${teamName}` : `Declined ${teamName}`);
    await refetch();
    router.refresh();
  }

  const invitations = data?.myTeamInvitations ?? [];

  return (
    <div className="flex flex-col">
      <PageTitle
        title="Team invitations"
        eyebrow={<span>Invitations</span>}
        meta={
          <Badge variant="neutral" size="sm">
            {invitations.length} pending
          </Badge>
        }
      />
      <div className="p-8 max-w-2xl space-y-3">
        {loading && invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          invitations.map((inv) => (
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
                      "{inv.message}"
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
      </div>
    </div>
  );
}
