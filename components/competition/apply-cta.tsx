"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Status-aware competition-hero CTA.
 *
 *   - no application / CANCELLED / REJECTED → Apply with my team
 *     (the apply form resurrects a cancelled/rejected row on submit)
 *   - INVITED / PENDING / WAITLISTED / APPROVED → a status badge
 *
 * Round-62 — the hero is status-only now. All actions (accept/decline an
 * invite, withdraw, edit roster) live on the Applications-tab invite +
 * application cards, so the hero no longer carries a "Re-apply" or "Withdraw"
 * button — those were redundant and easy to click by accident.
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
  const s = myApplication?.status;

  // No live application (never applied, or a previously withdrawn/rejected
  // one) → the plain entry CTA. Submitting resurrects a CANCELLED/REJECTED row.
  if (!myApplication || s === "CANCELLED" || s === "REJECTED") {
    return (
      <Link href={`/competitions/${competitionSlug}/apply`}>
        <Button>Apply with my team</Button>
      </Link>
    );
  }

  // Live application / invite — the hero just reflects status; manage it from
  // the Applications-tab cards.
  if (s === "INVITED") {
    return (
      <Badge variant="primary" data-testid="apply-status-INVITED">
        Invited
      </Badge>
    );
  }
  const label =
    s === "PENDING"
      ? "Application pending"
      : s === "WAITLISTED"
        ? "Waitlisted"
        : "Approved";
  const variant: "neutral" | "warning" | "success" =
    s === "APPROVED" ? "success" : s === "WAITLISTED" ? "warning" : "neutral";
  return (
    <Badge variant={variant} data-testid={`apply-status-${s}`}>
      {label}
    </Badge>
  );
}
