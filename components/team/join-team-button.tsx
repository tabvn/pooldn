"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { RequestToJoinTeamMutation } from "@/lib/graphql/operations/team-collab.operations";

export function JoinTeamButton({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [request, { loading }] = useMutation(RequestToJoinTeamMutation);
  const [sent, setSent] = useState(false);

  async function onClick() {
    try {
      await request({ variables: { teamId, message: null } });
      setSent(true);
      toast.success(
        "Request sent",
        `The captain of ${teamName} will review it.`,
      );
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not request to join",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  return (
    <Button
      variant="outline"
      iconBefore={<UserPlus className="size-4" />}
      onClick={onClick}
      loading={loading}
      disabled={sent}
      data-testid="request-to-join"
    >
      {sent ? "Request sent" : "Request to join"}
    </Button>
  );
}
