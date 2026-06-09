"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import {
  CheckCircle2,
  CirclePlay,
  Lock,
  MoreVertical,
  Pencil,
  RotateCcw,
  Rocket,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { CompetitionStatus } from "@/lib/generated/prisma/enums";
import {
  CancelCompetitionMutation,
  CloseApplicationsMutation,
  CompleteCompetitionMutation,
  DeleteCompetitionMutation,
  PublishCompetitionMutation,
  ReopenCancelledCompetitionMutation,
  ReopenCompetitionMutation,
  StartCompetitionMutation,
} from "@/lib/graphql/operations/competition-mutations.operations";

export function LifecycleActions({
  competitionId,
  competitionSlug,
  status,
}: {
  competitionId: string;
  competitionSlug: string;
  status: CompetitionStatus;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [publish, publishState] = useMutation(PublishCompetitionMutation);
  const [closeApps, closeState] = useMutation(CloseApplicationsMutation);
  const [start, startState] = useMutation(StartCompetitionMutation);
  const [complete, completeState] = useMutation(CompleteCompetitionMutation);
  const [cancel, cancelState] = useMutation(CancelCompetitionMutation);
  const [del, delState] = useMutation(DeleteCompetitionMutation);
  const [reopen, reopenState] = useMutation(ReopenCompetitionMutation);
  const [reopenCancelled, reopenCancelledState] = useMutation(
    ReopenCancelledCompetitionMutation,
  );

  const busy =
    publishState.loading ||
    closeState.loading ||
    startState.loading ||
    completeState.loading ||
    cancelState.loading ||
    delState.loading ||
    reopenState.loading ||
    reopenCancelledState.loading;

  const variables = { id: competitionId };
  const refresh = () => router.refresh();

  const items: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    show: boolean;
    variant?: "default" | "danger";
    confirm?: string;
    href?: string;
    run?: () => Promise<unknown>;
  }> = [
    {
      key: "edit",
      label: "Edit details",
      icon: <Pencil className="size-4" />,
      show: status !== "CANCELLED",
      href: `/competitions/${competitionSlug}/edit`,
    },
    {
      key: "reopen-cancelled",
      label: "Reopen — back to draft",
      icon: <RotateCcw className="size-4" />,
      show: status === "CANCELLED",
      confirm:
        "Reopen this cancelled competition back to DRAFT? You'll be able to edit and publish it again.",
      run: () => reopenCancelled({ variables }),
    },
    {
      key: "publish",
      label: "Publish — open for applications",
      icon: <Rocket className="size-4" />,
      show: status === "DRAFT",
      run: () => publish({ variables }),
    },
    {
      key: "close",
      label: "Close applications",
      icon: <Lock className="size-4" />,
      show: status === "OPEN_FOR_APPLICATIONS",
      run: () => closeApps({ variables }),
    },
    {
      key: "start",
      label: "Start competition",
      icon: <CirclePlay className="size-4" />,
      show:
        status === "APPLICATIONS_CLOSED" || status === "OPEN_FOR_APPLICATIONS",
      run: () => start({ variables }),
    },
    {
      key: "complete",
      label: "Complete competition",
      icon: <CheckCircle2 className="size-4" />,
      show: status === "ONGOING",
      confirm: "Mark this competition completed?",
      run: () => complete({ variables }),
    },
    {
      key: "reopen",
      label: "Reopen competition",
      icon: <RotateCcw className="size-4" />,
      show: status === "COMPLETED",
      confirm:
        "Reopen this competition? Winner banner clears and standings recompute live.",
      run: () => reopen({ variables }),
    },
    {
      key: "cancel",
      label: "Cancel competition",
      icon: <XCircle className="size-4" />,
      show: status !== "DRAFT" && status !== "COMPLETED",
      variant: "danger" as const,
      confirm: "Cancel this competition? This can't be undone.",
      run: () => cancel({ variables }),
    },
    {
      key: "delete",
      label: "Delete draft",
      icon: <Trash2 className="size-4" />,
      show: status === "DRAFT",
      variant: "danger" as const,
      confirm:
        "Delete this DRAFT competition? Applications and matchdays will be removed.",
      run: async () => {
        const r = await del({ variables });
        if (r.data?.deleteCompetition) {
          toast.success("Competition deleted");
          router.push("/");
          router.refresh();
        }
      },
    },
  ].filter((i) => i.show);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Competition actions"
        disabled={busy}
        data-testid="lifecycle-menu"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {items.map((item, idx) => (
          <div key={item.key}>
            {idx > 0 && item.variant === "danger" ? (
              <DropdownMenuSeparator />
            ) : null}
            <DropdownMenuItem
              variant={item.variant}
              render={
                item.href
                  ? (props) => <Link href={item.href!} {...props} />
                  : undefined
              }
              onClick={
                item.href
                  ? undefined
                  : async () => {
                      if (item.confirm) {
                        const ok = await confirm({
                          title: item.label,
                          description: item.confirm,
                          destructive: item.variant === "danger",
                          confirmLabel: item.label,
                        });
                        if (!ok) return;
                      }
                      if (!item.run) return;
                      try {
                        await item.run();
                        toast.success(`${item.label} done`);
                        refresh();
                      } catch (e) {
                        toast.error(
                          `${item.label} failed`,
                          e instanceof Error ? e.message : "Try again.",
                        );
                      }
                    }
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
