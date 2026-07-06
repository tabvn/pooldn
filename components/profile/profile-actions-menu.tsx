"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Ban, MoreVertical, Pencil, ShieldCheck } from "lucide-react";
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
  BanUserMutation,
  UnbanUserMutation,
} from "@/lib/graphql/operations/admin-moderation.operations";

/**
 * Kebab dropdown for the profile hero — collapses Edit / Edit (admin) /
 * Ban-Unban into a single "⋮" menu so the header stays clean.
 */
export function ProfileActionsMenu({
  userId,
  username,
  userName,
  bannedAt,
  isSelf,
  isAdmin,
}: {
  userId: string;
  username: string;
  userName: string;
  bannedAt: string | null;
  isSelf: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [banUser, { loading: banning }] = useMutation(BanUserMutation);
  const [unbanUser, { loading: unbanning }] = useMutation(UnbanUserMutation);
  const busy = banning || unbanning;

  const canEdit = isSelf || isAdmin;
  const canModerate = isAdmin && !isSelf;
  // Nothing actionable for this viewer → no menu at all.
  if (!canEdit && !canModerate) return null;

  const isBanned = !!bannedAt;

  async function onBan() {
    const reason = await prompt({
      title: `Ban ${userName}?`,
      description:
        "This user will be locked out of the entire app immediately. Give them a reason — it shows on their banned screen.",
      inputLabel: "Ban reason",
      inputPlaceholder: "e.g. Repeated harassment in chat (case #42)",
      confirmLabel: "Ban user",
      destructive: true,
      required: true,
    });
    if (reason === null) return;
    try {
      await banUser({ variables: { id: userId, reason } });
      toast.success(`${userName} banned`);
      router.refresh();
    } catch (e) {
      toast.error("Could not ban user", e);
    }
  }

  async function onUnban() {
    const ok = await confirm({
      title: `Unban ${userName}?`,
      description: "They'll regain full access immediately.",
      confirmLabel: "Unban",
    });
    if (!ok) return;
    try {
      await unbanUser({ variables: { id: userId } });
      toast.success(`${userName} unbanned`);
      router.refresh();
    } catch (e) {
      toast.error("Could not unban user", e);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Profile actions"
        disabled={busy}
        data-testid="profile-actions-menu"
        className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-secondary/40 hover:bg-secondary"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {isSelf ? (
          <DropdownMenuItem
            render={(props) => <Link href="/settings" {...props} />}
            data-testid="profile-actions-edit"
          >
            <Pencil className="size-4" />
            <span>Edit profile</span>
          </DropdownMenuItem>
        ) : isAdmin ? (
          <DropdownMenuItem
            render={(props) => (
              <Link href={`/admin/players/${username}/edit`} {...props} />
            )}
            data-testid="admin-edit-player"
          >
            <Pencil className="size-4" />
            <span>Edit player (admin)</span>
          </DropdownMenuItem>
        ) : null}
        {canModerate ? (
          <>
            <DropdownMenuSeparator />
            {isBanned ? (
              <DropdownMenuItem
                onClick={onUnban}
                data-testid={`profile-unban-user-${userId}`}
              >
                <ShieldCheck className="size-4" />
                <span>Unban user</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant="danger"
                onClick={onBan}
                data-testid={`profile-ban-user-${userId}`}
              >
                <Ban className="size-4" />
                <span>Ban user</span>
              </DropdownMenuItem>
            )}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
