"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import {
  Ban,
  MoreVertical,
  Pencil,
  ShieldCheck,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm, usePrompt } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  BanTeamMutation,
  DeleteTeamHardMutation,
  UnbanTeamMutation,
} from "@/lib/graphql/operations/admin-moderation.operations";

/**
 * Round-47 — single kebab dropdown for team-management actions.
 *
 * Replaces the row of buttons (Manage roster · Edit team · Ban · Delete)
 * with a single ":" menu so the header stays clean for captains and admins.
 */
export function TeamActionsMenu({
  teamId,
  teamSlug,
  teamName,
  bannedAt,
  isCaptain,
  isAdmin,
}: {
  teamId: string;
  teamSlug: string;
  teamName: string;
  bannedAt: string | null;
  isCaptain: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [banTeam, { loading: banning }] = useMutation(BanTeamMutation);
  const [unbanTeam, { loading: unbanning }] = useMutation(UnbanTeamMutation);
  const [del, { loading: deleting }] = useMutation(DeleteTeamHardMutation);
  const busy = banning || unbanning || deleting;
  const isBanned = !!bannedAt;
  const canManage = isCaptain || isAdmin;
  if (!canManage) return null;

  async function onBan() {
    const reason = await prompt({
      title: `Ban ${teamName}?`,
      description:
        "Team is hidden everywhere and members can't play matches. Reason shows on the moderation list.",
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
        "This wipes the team, its roster, invitations and chat history. This can't be undone.",
      confirmLabel: "Delete team",
      destructive: true,
    });
    if (!ok) return;
    try {
      await del({ variables: { id: teamId } });
      toast.success(`${teamName} deleted`);
      router.push("/teams");
    } catch (e) {
      toast.error("Could not delete team", e);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Team actions"
        disabled={busy}
        data-testid="team-actions-menu"
        className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-secondary/40 hover:bg-secondary"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          render={(props) => (
            <Link href={`/teams/${teamSlug}/manage`} {...props} />
          )}
          data-testid="team-actions-manage"
        >
          <UsersIcon className="size-4" />
          <span>Manage roster</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          render={(props) => (
            <Link href={`/teams/${teamSlug}/edit`} {...props} />
          )}
          data-testid="team-actions-edit"
        >
          <Pencil className="size-4" />
          <span>Edit team</span>
        </DropdownMenuItem>
        {isAdmin ? (
          <>
            <DropdownMenuSeparator />
            {isBanned ? (
              <DropdownMenuItem
                onClick={onUnban}
                data-testid="team-actions-unban"
              >
                <ShieldCheck className="size-4" />
                <span>Unban team</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant="danger"
                onClick={onBan}
                data-testid="team-actions-ban"
              >
                <Ban className="size-4" />
                <span>Ban team</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="danger"
              onClick={onDelete}
              data-testid="team-actions-delete"
            >
              <Trash2 className="size-4" />
              <span>Delete team</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
