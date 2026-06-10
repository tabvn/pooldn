"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { WithdrawApplicationMutation } from "@/lib/graphql/operations/competition-mutations.operations";

/**
 * Round-49 — shared Accept / Decline action pair for competition invites.
 *
 * Accept routes the captain through the existing /apply form (same UI any
 * team uses to join an OPEN comp — the INVITED row joins the resurrection
 * path inside applyToCompetition and flips to PENDING on submit). Decline
 * fires withdrawApplication in-place: spinner → Sonner toast → onDeclined
 * callback so the parent can dismiss / refetch.
 */
export function CompetitionInviteActions({
  applicationId,
  competitionSlug,
  teamId,
  teamName,
  size = "sm",
  onDeclined,
}: {
  applicationId: string;
  competitionSlug: string;
  teamId: string;
  teamName: string;
  size?: "sm" | "md" | "lg";
  onDeclined?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [withdraw] = useMutation(WithdrawApplicationMutation);
  const [declining, setDeclining] = useState(false);

  async function onDecline() {
    setDeclining(true);
    try {
      await withdraw({ variables: { id: applicationId } });
      toast.success(
        `Invite declined for ${teamName}`,
        "The organizer can re-invite your team later if they'd like.",
      );
      onDeclined?.();
      router.refresh();
    } catch (e) {
      toast.error(
        "Couldn't decline invite",
        e instanceof Error ? e.message : "Try again.",
      );
    } finally {
      setDeclining(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size={size}
        loading={declining}
        disabled={declining}
        onClick={onDecline}
        data-testid={`competition-invite-decline-${teamId}`}
      >
        <X className="size-4" />
        Decline
      </Button>
      <Link
        href={`/competitions/${competitionSlug}/apply?teamId=${teamId}`}
        data-testid={`competition-invite-accept-${teamId}`}
      >
        <Button variant="primary" size={size} disabled={declining}>
          Accept invite
        </Button>
      </Link>
    </div>
  );
}
