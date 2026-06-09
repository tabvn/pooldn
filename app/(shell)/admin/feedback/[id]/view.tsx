"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { Select } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  DeleteFeedbackMutation,
  FeedbackDetailQuery,
  UpdateFeedbackStatusMutation,
} from "@/lib/graphql/operations/feedback.operations";

type Status = "NEW" | "REVIEWING" | "RESOLVED" | "CLOSED";

const BADGE: Record<Status, "primary" | "warning" | "success" | "neutral"> = {
  NEW: "primary",
  REVIEWING: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export function FeedbackDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, refetch } = useQuery(FeedbackDetailQuery, {
    variables: { id },
    fetchPolicy: "cache-and-network",
  });
  const [updateStatus, { loading: saving }] = useMutation(
    UpdateFeedbackStatusMutation,
  );
  const [deleteFeedback] = useMutation(DeleteFeedbackMutation);
  const fb = data?.feedbackById;
  const [adminNote, setAdminNote] = useState("");
  const [status, setStatus] = useState<Status>("NEW");

  // Sync local form with the fetched feedback row once it arrives.
  useEffect(() => {
    if (fb) {
      setStatus(fb.status as Status);
      setAdminNote(fb.adminNote ?? "");
    }
  }, [fb]);

  async function onSave(next: Status) {
    try {
      await updateStatus({
        variables: { id, status: next, adminNote: adminNote || null },
      });
      setStatus(next);
      toast.success("Status updated");
      await refetch();
    } catch (e) {
      toast.error("Could not update", e);
    }
  }

  async function onDelete() {
    if (!fb) return;
    const ok = await confirm({
      title: "Delete this feedback?",
      description: "This can't be undone.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteFeedback({ variables: { id } });
      toast.success("Deleted");
      router.push("/admin/feedback");
    } catch (e) {
      toast.error("Could not delete", e);
    }
  }

  if (loading && !fb) {
    return (
      <div className="p-8 max-w-2xl">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!fb) {
    return (
      <div className="p-8 max-w-2xl">
        <p className="text-sm text-muted-foreground">Not found.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl space-y-4">
      <Link
        href="/admin/feedback"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to inbox
      </Link>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>{fb.subject}</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={BADGE[fb.status as Status]} size="sm">
                  {fb.status}
                </Badge>
                <Badge variant="neutral" size="sm">
                  {fb.type}
                </Badge>
                <span>
                  Submitted <LocalDateTime value={fb.createdAt} />
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              data-testid="feedback-detail-delete"
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm whitespace-pre-wrap">{fb.message}</div>

          <div className="border-t border-border pt-4">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
              From
            </h3>
            {fb.user ? (
              <Link
                href={`/players/${fb.user.username}`}
                className="mt-2 inline-flex items-center gap-2 hover:underline"
              >
                <Avatar
                  size="sm"
                  src={fb.user.avatarUrl ?? undefined}
                  fallback={fb.user.name}
                />
                <div>
                  <div className="text-sm font-medium">{fb.user.name}</div>
                  <div className="text-xs text-muted-foreground">
                    @{fb.user.username} · {fb.user.email}
                  </div>
                </div>
              </Link>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Anonymous · {fb.contactEmail ?? "no contact"}
              </p>
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
              Manage
            </h3>
            <div className="flex items-end gap-2">
              <div className="space-y-1.5 min-w-44">
                <span className="text-xs text-muted-foreground">Status</span>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as Status)}
                  options={[
                    { value: "NEW", label: "New" },
                    { value: "REVIEWING", label: "Reviewing" },
                    { value: "RESOLVED", label: "Resolved" },
                    { value: "CLOSED", label: "Closed" },
                  ]}
                />
              </div>
              <Button
                size="sm"
                loading={saving}
                onClick={() => onSave(status)}
                data-testid="feedback-save-status"
              >
                Save
              </Button>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">
                Admin note (optional)
              </span>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                placeholder="Internal note for fellow admins…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="feedback-admin-note"
              />
            </div>
            {fb.resolvedBy && fb.resolvedAt ? (
              <p className="text-xs text-muted-foreground">
                Resolved by {fb.resolvedBy.name} ·{" "}
                <LocalDateTime value={fb.resolvedAt} />
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
