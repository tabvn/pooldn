"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Ban, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm, usePrompt } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  BanTeamMutation,
  DeleteTeamHardMutation,
  UnbanTeamMutation,
} from "@/lib/graphql/operations/admin-moderation.operations";

/**
 * Round-46 — admin-facing Ban / Unban / Delete control rendered on the team
 * header. Ban opens a prompt dialog for the reason; delete double-confirms.
 */
export function BanTeamButton({
  teamId,
  teamName,
  bannedAt,
  redirectOnDelete = "/teams",
}: {
  teamId: string;
  teamName: string;
  bannedAt: string | null;
  redirectOnDelete?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [banTeam, { loading: banning }] = useMutation(BanTeamMutation);
  const [unbanTeam, { loading: unbanning }] = useMutation(UnbanTeamMutation);
  const [deleteTeam, { loading: deleting }] = useMutation(
    DeleteTeamHardMutation,
  );
  const isBanned = !!bannedAt;

  async function onBan() {
    const reason = await prompt({
      title: `Ban ${teamName}?`,
      description:
        "The team will be hidden everywhere and its members can no longer play matches. Give a reason — it shows on the moderation list.",
      inputLabel: "Ban reason",
      inputPlaceholder: "e.g. Roster fraud confirmed by organizer",
      confirmLabel: "Ban team",
      destructive: true,
      required: true,
    });
    if (reason === null) return;
    try {
      await banTeam({ variables: { id: teamId, reason } });
      toast.success(`${teamName} banned`);
      router.refresh();
    } catch (e) {
      toast.error("Could not ban team", e);
    }
  }

  async function onUnban() {
    const ok = await confirm({
      title: `Unban ${teamName}?`,
      description: "The team will become visible and playable again.",
      confirmLabel: "Unban",
    });
    if (!ok) return;
    try {
      await unbanTeam({ variables: { id: teamId } });
      toast.success(`${teamName} unbanned`);
      router.refresh();
    } catch (e) {
      toast.error("Could not unban team", e);
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: `Delete ${teamName} permanently?`,
      description:
        "This wipes the team, its roster, invitations and chat history. This cannot be undone.",
      confirmLabel: "Delete team",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTeam({ variables: { id: teamId } });
      toast.success(`${teamName} deleted`);
      router.push(redirectOnDelete);
    } catch (e) {
      toast.error("Could not delete team", e);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isBanned ? (
        <Button
          variant="outline"
          onClick={onUnban}
          loading={unbanning}
          data-testid={`team-unban-${teamId}`}
        >
          <ShieldCheck className="size-3.5" />
          Unban
        </Button>
      ) : (
        <Button
          variant="danger"
          onClick={onBan}
          loading={banning}
          data-testid={`team-ban-${teamId}`}
        >
          <Ban className="size-3.5" />
          Ban
        </Button>
      )}
      <Button
        variant="ghost"
        onClick={onDelete}
        loading={deleting}
        aria-label="Delete team"
        data-testid={`team-delete-${teamId}`}
      >
        <Trash2 className="size-3.5 text-destructive" />
      </Button>
    </div>
  );
}
