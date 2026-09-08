"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Ghost, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { RelativeTime } from "@/components/ui/relative-time";
import { errorText } from "@/lib/apollo/error-message";
import {
  CancelShellClaimMutation,
  RequestShellClaimMutation,
} from "@/lib/graphql/operations/shell-claim.operations";
import { SHELL_EXPLAINER } from "./shell-badge";

type MyClaim = {
  id: string;
  status: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

/**
 * Round-88 — the "is this you?" panel on an unclaimed placeholder profile.
 *
 * This is the self-service half of claiming: no secret link, no email — the
 * person finds their own name on a roster, says it's them, and an organizer of
 * a competition that placeholder plays in confirms. Approval hands over every
 * match, roster spot and stat recorded under the placeholder.
 *
 * The page renders one of five states, all decided server-side (viewerCanClaim
 * / claimBlockedReason / myShellClaim) so the panel and the mutation can't
 * disagree about whether a claim is allowed.
 */
export function ClaimProfilePanel({
  shellUserId,
  shellName,
  username,
  isSignedIn,
  canClaim,
  blockedReason,
  myClaim,
}: {
  shellUserId: string;
  shellName: string;
  username: string;
  isSignedIn: boolean;
  canClaim: boolean;
  blockedReason: string | null;
  myClaim: MyClaim | null;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [request, { loading }] = useMutation(RequestShellClaimMutation);
  const [cancel, { loading: cancelling }] = useMutation(
    CancelShellClaimMutation,
  );

  const pending = myClaim?.status === "PENDING";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await request({
        variables: { shellUserId, message: message.trim() || null },
      });
      toast.success(
        "Claim sent",
        `An organizer will confirm that ${shellName} is you.`,
      );
      setOpen(false);
      setMessage("");
      router.refresh();
    } catch (err) {
      toast.error(
        "Couldn't send that claim",
        errorText(err, "Try again."),
      );
    }
  }

  async function onCancel() {
    if (!myClaim) return;
    const ok = await confirm({
      title: "Withdraw this claim?",
      description: `Your request to claim ${shellName} is removed. You can ask again later.`,
      confirmLabel: "Withdraw",
      destructive: true,
    });
    if (!ok) return;
    try {
      await cancel({ variables: { id: myClaim.id } });
      toast.success("Claim withdrawn");
      router.refresh();
    } catch (err) {
      toast.error(
        "Couldn't withdraw",
        errorText(err, "Try again."),
      );
    }
  }

  return (
    <Card
      className="border-warning/40 bg-warning/5"
      data-testid="claim-profile-panel"
    >
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-warning/60 bg-warning/10 text-warning">
            <Ghost className="size-5" />
          </span>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">
              {shellName} is a placeholder profile
            </h2>
            <p className="text-sm text-muted-foreground">
              {SHELL_EXPLAINER}
            </p>
          </div>
        </div>

        {pending ? (
          <div
            className="space-y-3 rounded-lg border border-border bg-card p-4"
            data-testid="claim-pending"
          >
            <p className="text-sm">
              <span className="font-semibold">Waiting for review.</span> You
              asked to claim this profile{" "}
              <RelativeTime value={myClaim!.createdAt} />. An organizer of a
              competition {shellName} plays in — or an admin — confirms it.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={cancelling}
              data-testid="claim-cancel"
            >
              {cancelling ? "Withdrawing…" : "Withdraw claim"}
            </Button>
          </div>
        ) : !isSignedIn ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">Is this you?</p>
            <Link href={`/sign-in?next=/players/${username}`}>
              <Button size="sm" data-testid="claim-sign-in">
                Sign in to claim it
              </Button>
            </Link>
          </div>
        ) : blockedReason ? (
          <p
            className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
            data-testid="claim-blocked"
          >
            {blockedReason}
          </p>
        ) : canClaim ? (
          <>
            {myClaim?.status === "REJECTED" ? (
              <p
                className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
                data-testid="claim-rejected"
              >
                Your earlier claim wasn&apos;t approved
                {myClaim.reviewNote ? `: “${myClaim.reviewNote}”` : "."} You can
                ask again with more detail.
              </p>
            ) : null}
            {open ? (
              <form
                onSubmit={onSubmit}
                className="space-y-3 rounded-lg border border-border bg-card p-4"
                data-testid="claim-form"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="claim-message">
                    How can the organizer tell it&apos;s you?{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <textarea
                    id="claim-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. I play for Dragons on Tuesdays — Minh has my number."
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Approving hands you every match, roster spot and stat
                    recorded for {shellName}.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={loading}>
                    {loading ? "Sending…" : "Send claim"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                onClick={() => setOpen(true)}
                data-testid="claim-start"
                size="sm"
              >
                This is me — claim this profile
              </Button>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * The reviewer's counterpart: an organizer or admin looking at a placeholder
 * that people have asked for. Points at the queue rather than deciding here —
 * the decision needs the competition context that the queue screen carries.
 */
export function ClaimReviewNudge({
  count,
  href,
}: {
  count: number;
  href: string;
}) {
  if (count < 1) return null;
  return (
    <Card className="border-info/40 bg-info/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-info" />
          <p className="text-sm">
            <span className="font-semibold">
              {count} {count === 1 ? "person has" : "people have"}
            </span>{" "}
            asked to claim this profile.
          </p>
        </div>
        <Link href={href}>
          <Button size="sm" variant="secondary" data-testid="claim-review-link">
            Review {count === 1 ? "it" : "them"}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
