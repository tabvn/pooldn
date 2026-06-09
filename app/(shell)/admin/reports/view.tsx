"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Flag, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { Select } from "@/components/ui/select";
import { PageTitle } from "@/components/layout/page-title";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  CommunityReportsQuery,
  ResolveCommunityReportMutation,
} from "@/lib/graphql/operations/community-moderation.operations";

type Status = "OPEN" | "RESOLVED" | "DISMISSED";

const BADGE: Record<Status, "primary" | "warning" | "success" | "neutral"> = {
  OPEN: "warning",
  RESOLVED: "success",
  DISMISSED: "neutral",
};

const PAGE = 25;

export function ReportsAdmin() {
  const toast = useToast();
  const [status, setStatus] = useState<Status>("OPEN");
  const { data, loading, error, refetch, fetchMore } = useQuery(
    CommunityReportsQuery,
    {
      variables: { status, first: PAGE },
      fetchPolicy: "network-only",
      notifyOnNetworkStatusChange: true,
    },
  );
  const [resolve, { loading: resolving }] = useMutation(
    ResolveCommunityReportMutation,
  );

  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const rows = data?.communityReports ?? [];

  async function loadMore() {
    const last = rows[rows.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const r = await fetchMore({
        variables: { after: last.id },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.communityReports) return prev;
          return {
            ...prev,
            communityReports: [
              ...prev.communityReports,
              ...fetchMoreResult.communityReports,
            ],
          };
        },
      });
      const next = r.data?.communityReports ?? [];
      if (next.length < PAGE) setDone(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function act(id: string, newStatus: "RESOLVED" | "DISMISSED") {
    try {
      await resolve({ variables: { id, status: newStatus } });
      toast.success(
        newStatus === "RESOLVED" ? "Marked resolved" : "Dismissed",
      );
      await refetch();
    } catch (e) {
      toast.error("Could not update", e);
    }
  }

  return (
    <div className="flex flex-col">
      <PageTitle
        title="Community reports"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Flag className="size-3.5" /> Admin
          </span>
        }
      />
      <div className="p-8 space-y-4">
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 min-w-40">
            <span className="text-xs text-muted-foreground">Status</span>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as Status)}
              options={[
                { value: "OPEN", label: "Open" },
                { value: "RESOLVED", label: "Resolved" },
                { value: "DISMISSED", label: "Dismissed" },
              ]}
            />
          </div>
          <Badge variant="neutral">{rows.length} loaded</Badge>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !data ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Loading…
                      </p>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <p className="py-10 text-center text-sm text-destructive">
                        Could not load reports: {error.message}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        Inbox is empty.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const targetHref =
                      r.targetType === "POST"
                        ? `/community/${r.targetId}`
                        : r.targetPostId
                          ? `/community/${r.targetPostId}?c=${r.targetId}`
                          : "/community";
                    return (
                      <TableRow key={r.id} data-testid={`report-row-${r.id}`}>
                        <TableCell>
                          <Link
                            href={`/players/${r.reporter.username}`}
                            className="inline-flex items-center gap-2 hover:underline"
                          >
                            <Avatar
                              size="sm"
                              src={r.reporter.avatarUrl ?? undefined}
                              fallback={r.reporter.name}
                            />
                            <div className="text-sm">
                              <div className="font-medium">
                                {r.reporter.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                @{r.reporter.username}
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={targetHref}
                            className="text-primary hover:underline"
                          >
                            {r.targetType.toLowerCase()} →
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="line-clamp-2 text-sm">{r.reason}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={BADGE[r.status as Status]} size="sm">
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <LocalDateTime value={r.createdAt} />
                        </TableCell>
                        <TableCell>
                          {r.status === "OPEN" ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => act(r.id, "RESOLVED")}
                                loading={resolving}
                                data-testid={`report-resolve-${r.id}`}
                              >
                                <ShieldCheck className="size-3.5" /> Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => act(r.id, "DISMISSED")}
                                loading={resolving}
                                data-testid={`report-dismiss-${r.id}`}
                              >
                                Dismiss
                              </Button>
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {!done && rows.length >= PAGE ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              loading={loadingMore}
              onClick={loadMore}
              data-testid="reports-load-more"
            >
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
