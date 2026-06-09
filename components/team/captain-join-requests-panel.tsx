"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { Inbox } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { useToast } from "@/components/ui/toast";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import {
  ReviewJoinRequestMutation,
  TeamJoinRequestsQuery,
} from "@/lib/graphql/operations/team-collab.operations";

/**
 * Round-47 — Overview-tab card that shows the captain (and SUPER_ADMIN) every
 * pending join request for THIS team, with Approve/Decline directly inline.
 * The captain notification's deep-link lands here (team detail) so they don't
 * have to bounce into /manage just to triage requests.
 */
export function CaptainJoinRequestsPanel({
  teamId,
  teamSlug,
  captainId,
}: {
  teamId: string;
  teamSlug: string;
  captainId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const viewerQuery = useQuery(ViewerQuery, {
    fetchPolicy: "cache-first",
    errorPolicy: "ignore",
  });
  const viewer = viewerQuery.data?.viewer;
  const isCaptain = !!viewer && viewer.id === captainId;
  const isAdmin = viewer?.role === "SUPER_ADMIN";
  const canManage = isCaptain || isAdmin;

  const joinReqQuery = useQuery(TeamJoinRequestsQuery, {
    variables: { teamId },
    skip: !canManage,
    fetchPolicy: "cache-and-network",
  });
  const [review, { loading: reviewing }] = useMutation(
    ReviewJoinRequestMutation,
  );

  if (!canManage) return null;

  const requests = joinReqQuery.data?.teamJoinRequests ?? [];
  if (requests.length === 0) return null;

  async function onReview(id: string, approve: boolean, name: string) {
    try {
      await review({ variables: { id, approve } });
      toast.success(approve ? `${name} added to roster` : `Declined ${name}`);
      await joinReqQuery.refetch();
      router.refresh();
    } catch (e) {
      toast.error("Could not update join request", e);
    }
  }

  return (
    <Card
      className="md:col-span-2 border-primary/30"
      data-testid="overview-join-requests"
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Inbox className="size-4 text-primary" />
            Pending join requests
            <Badge variant="primary" size="sm">
              {requests.length}
            </Badge>
          </CardTitle>
          <Link
            href={`/teams/${teamSlug}/manage`}
            className="text-xs text-primary hover:underline"
          >
            Manage roster →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {requests.map((req) => (
            <li
              key={req.id}
              className="flex flex-col gap-2 rounded-md border border-border bg-background px-3 py-2 sm:flex-row sm:items-center"
              data-testid={`overview-join-request-${req.id}`}
            >
              <Link
                href={`/players/${req.user.username}`}
                className="flex flex-1 items-center gap-3 hover:underline min-w-0"
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
                    @{req.user.username} ·{" "}
                    <LocalDateTime value={req.createdAt} variant="date" />
                    {req.message ? ` · "${req.message}"` : ""}
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  loading={reviewing}
                  onClick={() => onReview(req.id, true, req.user.name)}
                  data-testid={`overview-join-approve-${req.id}`}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onReview(req.id, false, req.user.name)}
                  data-testid={`overview-join-decline-${req.id}`}
                >
                  Decline
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
