"use client";

import { useRouter } from "next/navigation";
import { useSubscription } from "@apollo/client/react";
import { CompetitionStandingsUpdatedSubscription } from "@/lib/graphql/operations/subscriptions.operations";

/**
 * Drop into any server-rendered standings table to make it live.
 *
 * Subscribes to `competitionStandingsUpdated` over SSE; on every event,
 * triggers an RSC refresh so the parent server component re-fetches the
 * standings + re-renders. Renders nothing visible — pure side-effect.
 */
export function LiveStandingsListener({
  competitionId,
}: {
  competitionId: string;
}) {
  const router = useRouter();
  useSubscription(CompetitionStandingsUpdatedSubscription, {
    variables: { competitionId },
    onData: () => {
      router.refresh();
    },
  });
  return null;
}
