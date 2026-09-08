"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@apollo/client/react";
import { Ghost, ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RelativeTime } from "@/components/ui/relative-time";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { errorText } from "@/lib/apollo/error-message";
import {
  ReviewShellClaimMutation,
  ShellClaimRequestsQuery,
} from "@/lib/graphql/operations/shell-claim.operations";

/**
 * Round-88 — the review queue for placeholder-profile claims.
 *
 * One component, three mountings: an organizer's competition tab (scoped by
 * competitionId), the admin screen (unscoped — every claim in the app), and a
 * signed-in reviewer's own /claims page. The server decides what each viewer
 * may see and decide (shellClaimRequests + viewerCanReview), so the difference
 * between the three is only which rows come back.
 *
 * Approving is destructive in the "can't be undone" sense: the placeholder is
 * merged into the claimant's account and disappears. The confirm dialog says
 * exactly that.
 */

type Filter = "PENDING" | "ALL";

export function ClaimReviewList({
  competitionId,
  emptyHint,
  className,
}: {
  competitionId?: string | null;
  emptyHint?: string;
  className?: string;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  // Keyed by request id: one shared string would attach the note typed for one
  // claim to whichever claim happened to be decided next.
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, loading, refetch } = useQuery(ShellClaimRequestsQuery, {
    variables: {
      status: filter === "PENDING" ? ("PENDING" as const) : null,
      competitionId: competitionId ?? null,
      first: 100,
    },
    fetchPolicy: "cache-and-network",
  });
  const [review, { loading: reviewing }] = useMutation(ReviewShellClaimMutation);

  const rows = data?.shellClaimRequests ?? [];

  async function decide(
    id: string,
    approve: boolean,
    shellName: string,
    requesterName: string,
  ) {
    if (approve) {
      const ok = await confirm({
        title: `${requesterName} is ${shellName}?`,
        description: `Every match, roster spot and stat recorded for ${shellName} moves to ${requesterName}'s account, and the placeholder is removed. Standings and MVP recalculate. This can't be undone.`,
        confirmLabel: "Approve claim",
      });
      if (!ok) return;
    }
    try {
      await review({
        variables: { id, approve, note: notes[id]?.trim() || null },
      });
      toast.success(
        approve ? `${shellName} handed to ${requesterName}` : "Claim rejected",
        approve
          ? "Their history now lives on that account."
          : `${requesterName} was told, and ${shellName} stays a placeholder.`,
      );
      setNoteFor(null);
      setNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await refetch();
    } catch (e) {
      toast.error(
        "Couldn't save that decision",
        errorText(e, "Try again."),
      );
    }
  }

  return (
    <div className={cn("space-y-4", className)} data-testid="claim-review-list">
      {/* Local state, not routing — the queue is one screen with two views. */}
      <div className="flex gap-1 rounded-md border border-border p-1 w-fit">
        {(["PENDING", "ALL"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            data-active={filter === k || undefined}
            data-testid={`claims-filter-${k.toLowerCase()}`}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-semibold transition-colors",
              filter === k
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary/50",
            )}
          >
            {k === "PENDING" ? "Pending" : "All"}
          </button>
        ))}
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading claims…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="space-y-1 py-8 text-center">
            <Ghost className="mx-auto size-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              {filter === "PENDING"
                ? "No claims waiting"
                : "No claims yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {emptyHint ??
                "When a player finds their placeholder profile and says it's them, the request lands here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card data-testid={`claim-row-${r.id}`}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* placeholder → claimant, in that direction */}
                    <span className="flex items-center gap-2">
                      <Avatar size="sm" ghost fallback={r.shellName} />
                      <span className="text-sm font-semibold">
                        {r.shellName}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <Link
                      href={`/players/${r.requester.username}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Avatar
                        size="sm"
                        src={r.requester.avatarUrl ?? undefined}
                        fallback={r.requester.name}
                      />
                      <span className="text-sm font-semibold">
                        {r.requester.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{r.requester.username}
                      </span>
                    </Link>
                    <StatusBadge status={r.status} />
                    <span className="ml-auto text-xs text-muted-foreground">
                      <RelativeTime value={r.createdAt} />
                    </span>
                  </div>

                  {r.competitions.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Plays in</span>
                      {r.competitions.map((c) => (
                        <Link
                          key={c.id}
                          href={`/competitions/${c.slug}`}
                          className="rounded-md border border-border px-1.5 py-0.5 hover:border-primary/40"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  {r.message ? (
                    <p className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                      “{r.message}”
                    </p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      No note — check with the organizer or team before
                      approving.
                    </p>
                  )}

                  {r.status === "PENDING" && r.viewerCanReview ? (
                    <div className="space-y-2">
                      {noteFor === r.id ? (
                        <input
                          value={notes[r.id] ?? ""}
                          onChange={(e) =>
                            setNotes((prev) => ({
                              ...prev,
                              [r.id]: e.target.value,
                            }))
                          }
                          maxLength={300}
                          placeholder="Note to the player (optional)"
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary"
                          data-testid={`claim-note-${r.id}`}
                        />
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={reviewing}
                          onClick={() =>
                            decide(r.id, true, r.shellName, r.requester.name)
                          }
                          data-testid={`claim-approve-${r.id}`}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={reviewing}
                          onClick={() =>
                            decide(r.id, false, r.shellName, r.requester.name)
                          }
                          data-testid={`claim-reject-${r.id}`}
                        >
                          Reject
                        </Button>
                        {noteFor === r.id ? null : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setNoteFor(r.id)}
                          >
                            Add a note
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : r.status === "PENDING" ? (
                    <p className="text-xs text-muted-foreground">
                      Waiting on an organizer of this player&apos;s competition.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {r.status === "APPROVED" ? "Approved" : null}
                      {r.status === "REJECTED" ? "Rejected" : null}
                      {r.status === "CANCELLED" ? "Withdrawn by the player" : null}
                      {r.reviewedBy ? ` by ${r.reviewedBy.name}` : ""}
                      {r.reviewedAt ? (
                        <>
                          {" "}
                          <RelativeTime value={r.reviewedAt} />
                        </>
                      ) : null}
                      {r.reviewNote ? ` · “${r.reviewNote}”` : ""}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING") return <Badge variant="warning">Pending</Badge>;
  if (status === "APPROVED") return <Badge variant="success">Approved</Badge>;
  if (status === "REJECTED") return <Badge variant="danger">Rejected</Badge>;
  return <Badge variant="neutral">Withdrawn</Badge>;
}
