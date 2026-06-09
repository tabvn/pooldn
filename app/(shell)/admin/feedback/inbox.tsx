"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Inbox, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { PageTitle } from "@/components/layout/page-title";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DeleteFeedbackMutation,
  FeedbackInboxQuery,
} from "@/lib/graphql/operations/feedback.operations";

type FeedbackStatus = "NEW" | "REVIEWING" | "RESOLVED" | "CLOSED";
type FeedbackType = "BUG" | "FEATURE" | "OTHER";

const STATUS_BADGE: Record<FeedbackStatus, "neutral" | "warning" | "success" | "primary"> = {
  NEW: "primary",
  REVIEWING: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

const PAGE = 25;

export function FeedbackInbox() {
  const [status, setStatus] = useState<FeedbackStatus | "">("");
  const [type, setType] = useState<FeedbackType | "">("");
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, refetch, fetchMore } = useQuery(
    FeedbackInboxQuery,
    {
      variables: {
        status: (status || null) as FeedbackStatus | null,
        type: (type || null) as FeedbackType | null,
        first: PAGE,
      },
      fetchPolicy: "network-only",
      notifyOnNetworkStatusChange: true,
    },
  );

  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const pages = data?.feedbackInbox ?? [];

  async function loadMore() {
    const last = pages[pages.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const r = await fetchMore({
        variables: { after: last.id },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.feedbackInbox) return prev;
          return {
            ...prev,
            feedbackInbox: [
              ...prev.feedbackInbox,
              ...fetchMoreResult.feedbackInbox,
            ],
          };
        },
      });
      const next = r.data?.feedbackInbox ?? [];
      if (next.length < PAGE) setDone(true);
    } finally {
      setLoadingMore(false);
    }
  }
  const [deleteFeedback, { loading: deleting }] = useMutation(
    DeleteFeedbackMutation,
  );

  async function onDelete(id: string, subject: string) {
    const ok = await confirm({
      title: "Delete this feedback?",
      description: `"${subject}" will be removed permanently. This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteFeedback({ variables: { id } });
      toast.success("Feedback deleted");
      await refetch();
    } catch (e) {
      toast.error("Could not delete", e);
    }
  }

  const rows = pages;
  const unread = data?.feedbackUnreadCount ?? 0;

  return (
    <div className="flex flex-col">
      <PageTitle
        title="Feedback inbox"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Inbox className="size-3.5" /> Admin
          </span>
        }
        meta={
          <>
            <Badge variant="primary">{unread} new</Badge>
            <Badge variant="neutral">{rows.length} loaded</Badge>
          </>
        }
      />
      <div className="p-8 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 min-w-40">
            <span className="text-xs text-muted-foreground">Status</span>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as FeedbackStatus | "")}
              options={[
                { value: "", label: "All statuses" },
                { value: "NEW", label: "New" },
                { value: "REVIEWING", label: "Reviewing" },
                { value: "RESOLVED", label: "Resolved" },
                { value: "CLOSED", label: "Closed" },
              ]}
            />
          </div>
          <div className="space-y-1.5 min-w-40">
            <span className="text-xs text-muted-foreground">Type</span>
            <Select
              value={type}
              onValueChange={(v) => setType(v as FeedbackType | "")}
              options={[
                { value: "", label: "All types" },
                { value: "BUG", label: "Bug" },
                { value: "FEATURE", label: "Feature" },
                { value: "OTHER", label: "Other" },
              ]}
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-12" aria-label="Actions" />
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
                        Could not load feedback: {error.message}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        Inbox is empty. 🎉
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id} data-testid={`feedback-row-${r.id}`}>
                      <TableCell>
                        <Link
                          href={`/admin/feedback/${r.id}`}
                          className="font-semibold hover:underline"
                        >
                          {r.subject}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {r.user ? (
                          <Link
                            href={`/players/${r.user.username}`}
                            className="inline-flex items-center gap-2 hover:underline"
                          >
                            <Avatar
                              size="sm"
                              src={r.user.avatarUrl ?? undefined}
                              fallback={r.user.name}
                            />
                            <div>
                              <div className="text-sm font-medium">
                                {r.user.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                @{r.user.username}
                              </div>
                            </div>
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {r.contactEmail ?? "Anonymous"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" size="sm">
                          {r.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[r.status]} size="sm">
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <LocalDateTime value={r.createdAt} />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={deleting}
                          onClick={() => onDelete(r.id, r.subject)}
                          aria-label="Delete feedback"
                          data-testid={`feedback-delete-${r.id}`}
                        >
                          <Trash2 className="size-3.5 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
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
              data-testid="feedback-load-more"
            >
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
