"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationStatusChip } from "@/components/ui/status-chip";
import {
  CompetitionApplicationsQuery,
} from "@/lib/graphql/operations/competition.operations";
import { ReviewApplicationMutation } from "@/lib/graphql/operations/competition-mutations.operations";

function groupByStatus<T extends { status: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[item.status] = acc[item.status] ?? []).push(item);
    return acc;
  }, {});
}

export function ApplicationsList({ slug }: { slug: string }) {
  const { data, refetch } = useQuery(CompetitionApplicationsQuery, {
    variables: { slug },
  });
  const [review, { loading }] = useMutation(ReviewApplicationMutation);

  const applications = data?.competition?.applications ?? [];
  const groups = groupByStatus(applications);

  async function decide(applicationId: string, approve: boolean) {
    await review({ variables: { input: { applicationId, approve } } });
    await refetch();
  }

  return (
    <div className="space-y-6">
      {(["APPROVED", "PENDING", "REJECTED", "WAITLISTED", "CANCELLED"] as const).map(
        (status) =>
          (groups[status]?.length ?? 0) === 0 ? null : (
            <Card key={status}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{status.toLowerCase()}</CardTitle>
                  <Badge variant="neutral">{groups[status].length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {groups[status].map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar size="md" fallback={app.team.name} />
                      <div>
                        <div className="font-semibold">{app.team.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Captain: {app.team.captain.name}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ApplicationStatusChip status={app.status} />
                      {app.status === "PENDING" ? (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            loading={loading}
                            onClick={() => decide(app.id, true)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={loading}
                            onClick={() => decide(app.id, false)}
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
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
