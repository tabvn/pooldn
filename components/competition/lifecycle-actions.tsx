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
import type { CompetitionStatus } from "@/lib/generated/prisma/enums";
import {
  CancelCompetitionMutation,
  CloseApplicationsMutation,
  CompleteCompetitionMutation,
  DeleteCompetitionMutation,
  PublishCompetitionMutation,
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
  const [publish, publishState] = useMutation(PublishCompetitionMutation);
  const [closeApps, closeState] = useMutation(CloseApplicationsMutation);
  const [start, startState] = useMutation(StartCompetitionMutation);
  const [complete, completeState] = useMutation(CompleteCompetitionMutation);
  const [cancel, cancelState] = useMutation(CancelCompetitionMutation);
  const [del, delState] = useMutation(DeleteCompetitionMutation);

  const busy =
    publishState.loading ||
    closeState.loading ||
    startState.loading ||
    completeState.loading ||
    cancelState.loading ||
    delState.loading;

  // Round-12 TASK 2: keep the kebab visible on every non-cancelled status
  // so organizers can still Edit ONGOING / COMPLETED competitions.
  if (status === "CANCELLED") return null;

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
      show: true,
      href: `/competitions/${competitionSlug}/edit`,
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
                      if (item.confirm && !window.confirm(item.confirm))
                        return;
                      if (!item.run) return;
                      await item.run();
                      refresh();
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
