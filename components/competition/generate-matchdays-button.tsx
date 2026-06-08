"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { GenerateMatchdaysMutation } from "@/lib/graphql/operations/matchday.operations";

export function GenerateMatchdaysButton({
  competitionId,
}: {
  competitionId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [generate, { loading, error }] = useMutation(
    GenerateMatchdaysMutation,
  );
  return (
    <div className="space-y-2">
      <Button
        loading={loading}
        onClick={async () => {
          if (!window.confirm("Generate matchdays for all approved teams?"))
            return;
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
