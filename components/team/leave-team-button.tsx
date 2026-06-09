"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { LeaveTeamMutation } from "@/lib/graphql/operations/team-collab.operations";

export function LeaveTeamButton({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [leave, { loading }] = useMutation(LeaveTeamMutation);

  async function onClick() {
    const ok = await confirm({
      title: `Leave ${teamName}?`,
      description: "You'll lose access to private team channels and stats.",
      confirmLabel: "Leave team",
      destructive: true,
    });
    if (!ok) return;
    try {
      await leave({ variables: { teamId } });
      toast.success(`Left ${teamName}`);
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not leave team",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  return (
    <Button
      variant="ghost"
      iconBefore={<LogOut className="size-4" />}
      onClick={onClick}
      loading={loading}
      data-testid="leave-team"
    >
      Leave team
    </Button>
  );
}
