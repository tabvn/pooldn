"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { WithdrawApplicationMutation } from "@/lib/graphql/operations/competition-mutations.operations";

/**
 * Status-aware "Apply with my team" CTA.
 *
 *   - no application yet                → Apply with my team
 *   - PENDING                           → Application pending (disabled) + Withdraw
 *   - WAITLISTED                        → Waitlisted (disabled) + Withdraw
 *   - APPROVED                          → Approved (disabled) + Withdraw
 *   - CANCELLED / REJECTED              → Re-apply
 */
export function ApplyCta({
  competitionSlug,
  myApplication,
}: {
  competitionSlug: string;
  myApplication: {
    id: string;
    status: string;
  } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [withdraw, { loading: withdrawing }] = useMutation(
    WithdrawApplicationMutation,
  );

  async function onWithdraw() {
    if (!myApplication) return;
    const ok = await confirm({
      title: "Withdraw your application?",
      description:
        "Your team will be removed from this competition's applicant list. You can re-apply later.",
      confirmLabel: "Withdraw",
      destructive: true,
    });
    if (!ok) return;
    try {
      await withdraw({ variables: { id: myApplication.id } });
      toast.success("Application withdrawn");
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not withdraw",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  if (!myApplication) {
    return (
      <Link href={`/competitions/${competitionSlug}/apply`}>
        <Button>Apply with my team</Button>
      </Link>
    );
  }

  const s = myApplication.status;
  if (s === "PENDING" || s === "WAITLISTED" || s === "APPROVED") {
    const label =
      s === "PENDING"
        ? "Application pending"
        : s === "WAITLISTED"
          ? "Waitlisted"
          : "Approved";
    const variant: "neutral" | "warning" | "success" =
      s === "APPROVED" ? "success" : s === "WAITLISTED" ? "warning" : "neutral";
    return (
      <div className="flex items-center gap-2">
        <Badge variant={variant} data-testid={`apply-status-${s}`}>
          {label}
        </Badge>
        <Button
          variant="ghost"
          loading={withdrawing}
          onClick={onWithdraw}
          data-testid="withdraw-application"
        >
          Withdraw
        </Button>
      </div>
    );
  }
  // CANCELLED / REJECTED → re-apply
  return (
    <Link href={`/competitions/${competitionSlug}/apply`}>
      <Button data-testid="reapply-button">Re-apply</Button>
    </Link>
  );
}
