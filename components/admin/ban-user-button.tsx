"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Ban, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm, usePrompt } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  BanUserMutation,
  UnbanUserMutation,
} from "@/lib/graphql/operations/admin-moderation.operations";

/**
 * Round-46 — admin-facing Ban/Unban control rendered on the player profile.
 * The ban path opens a prompt dialog so the admin can record a reason that
 * surfaces on the banned screen and in the moderation list.
 */
export function BanUserButton({
  userId,
  userName,
  bannedAt,
}: {
  userId: string;
  userName: string;
  bannedAt: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [banUser, { loading: banning }] = useMutation(BanUserMutation);
  const [unbanUser, { loading: unbanning }] = useMutation(UnbanUserMutation);
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

  return isBanned ? (
    <Button
      variant="outline"
      onClick={onUnban}
      loading={unbanning}
      data-testid={`profile-unban-user-${userId}`}
    >
      <ShieldCheck className="size-3.5" />
      Unban
    </Button>
  ) : (
    <Button
      variant="danger"
      onClick={onBan}
      loading={banning}
      data-testid={`profile-ban-user-${userId}`}
    >
      <Ban className="size-3.5" />
      Ban user
    </Button>
  );
}
