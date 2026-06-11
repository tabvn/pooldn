"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationStatusChip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { ApplicationDetailDialog } from "@/components/competition/application-detail-dialog";
import {
  CompetitionApplicationsQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";
import {
  InviteTeamsToCompetitionMutation,
  ReviewApplicationMutation,
} from "@/lib/graphql/operations/competition-mutations.operations";
import { InviteTeamsModal } from "./invite-teams-modal";

function groupByStatus<T extends { status: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[item.status] = acc[item.status] ?? []).push(item);
    return acc;
  }, {});
}

export function ApplicationsList({ slug }: { slug: string }) {
  const toast = useToast();
  const { data, refetch } = useQuery(CompetitionApplicationsQuery, {
    variables: { slug },
  });
  const { data: viewerData } = useQuery(ViewerQuery, {
    errorPolicy: "ignore",
    fetchPolicy: "cache-first",
  });
  const viewer = viewerData?.viewer ?? null;
  const [review, { loading }] = useMutation(ReviewApplicationMutation);
  const [reinvite, { loading: reinviting }] = useMutation(
    InviteTeamsToCompetitionMutation,
  );

  const competitionId = data?.competition?.id ?? "";
  const applications = data?.competition?.applications ?? [];
  const groups = groupByStatus(applications);

  // Server-side `inviteTeamsToCompetition` skips PENDING/APPROVED/WAITLISTED
  // — mirror that here so the modal disables the checkbox up-front.
  const engagedTeamIds = new Set(
    applications
      .filter(
        (a) =>
          a.status === "PENDING" ||
          a.status === "APPROVED" ||
          a.status === "WAITLISTED",
      )
      .map((a) => a.team?.id)
      .filter((id): id is string => Boolean(id)),
  );

  async function decide(applicationId: string, approve: boolean) {
    await review({ variables: { input: { applicationId, approve } } });
    await refetch();
  }

  async function reinviteOne(teamId: string) {
    try {
      await reinvite({
        variables: { competitionId, teamIds: [teamId], personalNote: null },
      });
      toast.success("Invite re-sent");
      await refetch();
    } catch (e) {
      toast.error(
        "Couldn't re-send invite",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        {competitionId ? (
          <InviteTeamsModal
            competitionId={competitionId}
            excludeTeamIds={engagedTeamIds}
            onInvited={() => refetch()}
          />
        ) : null}
      </div>
      {(
        [
          "APPROVED",
          "PENDING",
          "INVITED",
          "WAITLISTED",
          "REJECTED",
          "CANCELLED",
        ] as const
      ).map((status) =>
        (groups[status]?.length ?? 0) === 0 ? null : (
          <Card key={status}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{status.toLowerCase()}</CardTitle>
                <Badge variant="neutral">{groups[status].length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {groups[status].map((app) => {
                // Round-53 — INDIVIDUAL applications surface the solo
                // applicant instead of a team. Fall back gracefully when
                // both happen to be null (shouldn't happen — the resolver
                // enforces one or the other).
                const entityName =
                  app.team?.name ?? app.applicant?.name ?? "Unknown";
                const entityLogo = app.team?.logoUrl ?? app.applicant?.avatarUrl;
                const entityHref = app.team
                  ? `/teams/${app.team.slug}`
                  : app.applicant
                    ? `/players/${app.applicant.username}`
                    : "#";
                return (
                  <div
                    key={app.id}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        size="md"
                        src={entityLogo ?? undefined}
                        fallback={entityName}
                        shape={app.team ? "team" : "user"}
                      />
                      <div>
                        <Link
                          href={entityHref}
                          className="font-semibold hover:underline"
                        >
                          {entityName}
                        </Link>
                        {app.team ? (
                          <div className="text-xs text-muted-foreground">
                            Captain:{" "}
                            <Link
                              href={`/players/${app.team.captain.username}`}
                              className="hover:underline"
                            >
                              {app.team.captain.name}
                            </Link>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Solo registration
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ApplicationStatusChip status={app.status} />
                      {app.status !== "INVITED" && app.team ? (
                        <ApplicationDetailDialog
                          applicationId={app.id}
                          teamName={app.team.name}
                          competitionName={data?.competition?.name ?? undefined}
                          viewerId={viewer?.id ?? null}
                          viewerRole={viewer?.role ?? null}
                          triggerLabel={
                            app.status === "PENDING" ? "Review" : "View"
                          }
                        />
                      ) : null}
                      {app.status === "PENDING" ? (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            loading={loading}
                            onClick={() => decide(app.id, true)}
                            data-testid={`quick-approve-${app.id}`}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={loading}
                            onClick={() => decide(app.id, false)}
                            data-testid={`quick-reject-${app.id}`}
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                      {app.status === "INVITED" && app.team ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={reinviting}
                          onClick={() => reinviteOne(app.team!.id)}
                        >
                          Re-invite
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ),
      )}
      {applications.length === 0 ? (
        <p className="text-sm text-muted-foreground">No applications yet.</p>
      ) : null}
    </div>
  );
}
