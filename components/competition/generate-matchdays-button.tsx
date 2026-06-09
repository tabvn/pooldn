"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { GenerateMatchdaysMutation } from "@/lib/graphql/operations/matchday.operations";

export function GenerateMatchdaysButton({
  competitionId,
}: {
  competitionId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [generate, { loading, error }] = useMutation(
    GenerateMatchdaysMutation,
  );
  return (
    <div className="space-y-2">
      <Button
        loading={loading}
        onClick={async () => {
          const ok = await confirm({
            title: "Generate matchdays?",
            description:
              "This builds the round-robin schedule from every APPROVED team.",
            confirmLabel: "Generate",
          });
          if (!ok) return;
          try {
            await generate({ variables: { id: competitionId } });
            toast.success("Matchdays generated");
            router.refresh();
          } catch (e) {
            toast.error(
              "Could not generate matchdays",
              e instanceof Error ? e.message : undefined,
            );
          }
        }}
      >
        Generate matchdays
      </Button>
      {error ? (
        <p className="text-xs text-destructive">{error.message}</p>
      ) : null}
    </div>
  );
}
