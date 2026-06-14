"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { CompetitionStatus } from "@/lib/generated/prisma/enums";
import { CloseApplicationsMutation } from "@/lib/graphql/operations/competition-mutations.operations";
import { GenerateMatchdaysMutation } from "@/lib/graphql/operations/matchday.operations";

/**
 * Pre-start "Season Calendar" CTA (Figma node 299:9670). For an upcoming
 * competition the organizer closes applications and generates the round-
 * robin schedule in one action; once applications are already closed the
 * label collapses to just "Generate Calendar".
 */
export function SeasonCalendarCta({
  competitionId,
  status,
}: {
  competitionId: string;
  status: CompetitionStatus;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [closeApps, closeState] = useMutation(CloseApplicationsMutation);
  const [generate, genState] = useMutation(GenerateMatchdaysMutation);

  const open = status === "OPEN_FOR_APPLICATIONS";
  const label = open
    ? "Close Applications and Generate Calendar"
    : "Generate Calendar";

  return (
    <Button
      loading={closeState.loading || genState.loading}
      onClick={async () => {
        const ok = await confirm({
          title: label,
          description: open
            ? "Applications and unaccepted invites still pending will be excluded — the calendar is built from confirmed teams only. You won't be able to invite or accept new participants afterwards."
            : "Build the round-robin schedule from every confirmed team.",
          confirmLabel: label,
        });
        if (!ok) return;
        try {
          if (open) {
            await closeApps({ variables: { id: competitionId } });
          }
          await generate({ variables: { id: competitionId } });
          toast.success("Season calendar generated");
          router.refresh();
        } catch (e) {
          toast.error(
            "Could not generate the calendar",
            e instanceof Error ? e.message : undefined,
          );
        }
      }}
    >
      {label}
    </Button>
  );
}
