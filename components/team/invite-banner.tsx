"use client";

import { useMutation } from "@apollo/client/react";
import { Check, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { RespondToInvitationMutation } from "@/lib/graphql/operations/team-collab.operations";

type Invitation = {
  id: string;
  message?: string | null;
  createdAt: string;
  invitedBy?: { id: string; name: string; username: string } | null;
};

/**
 * Round-33 — banner shown on /teams/[slug] when the viewer has a pending
 * TeamInvitation for this team. Accept/Decline drive `respondToInvitation`;
 * the parent re-renders via router.refresh() so membership state updates.
 */
export function InviteBanner({
  invitation,
  team,
}: {
  invitation: Invitation;
  team: { name: string; logoUrl?: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const [respond, { loading }] = useMutation(RespondToInvitationMutation);

  async function onResp(accept: boolean) {
    try {
      await respond({ variables: { id: invitation.id, accept } });
      toast.success(
        accept ? `Welcome to ${team.name}` : "Invitation declined",
      );
      router.refresh();
    } catch (e) {
      toast.error("Could not respond", e);
    }
  }

  const date = new Date(invitation.createdAt).toLocaleDateString();
  const by = invitation.invitedBy?.name;
  return (
    <div
      className="mx-4 mt-4 flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 md:mx-8 md:flex-row md:items-center"
      data-testid="invite-banner"
    >
      <Avatar
        size="md"
        src={team.logoUrl ?? undefined}
        fallback={team.name}
        shape="team"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {team.name} invited you to join
        </p>
        <p className="text-xs text-muted-foreground">
          {by ? `Invited by ${by}` : "Invited"} · {date}
          {invitation.message ? ` · "${invitation.message}"` : ""}
        </p>
      </div>
      <div className="flex gap-2 md:ml-auto">
        <Button
          size="sm"
          variant="ghost"
          loading={loading}
          onClick={() => onResp(false)}
          data-testid="invite-decline"
        >
          <X className="size-3.5" /> Decline
        </Button>
        <Button
          size="sm"
          loading={loading}
          onClick={() => onResp(true)}
          data-testid="invite-accept"
        >
          <Check className="size-3.5" /> Accept
        </Button>
      </div>
    </div>
  );
}
