"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import { useToast } from "@/components/ui/toast";
import { CompleteCompetitionMutation } from "@/lib/graphql/operations/competition-mutations.operations";

export type FinalizeChampion = {
  name: string;
  href: string;
  image?: string | null;
  team: boolean;
};
export type FinalizeMvp = {
  username: string;
  name: string;
  avatarUrl?: string | null;
  nationality?: string | null;
};

/**
 * Round-71 — the organizer's "all matches played" review + publish step. Shows
 * the provisional Winner + MVP exactly as the completed screen will, plus a CTA
 * that finalises the competition (ONGOING → COMPLETED). Until it's published the
 * organizer can still fix results, MVP weights, etc.
 */
export function FinalizeWinnersCard({
  competitionId,
  champion,
  mvp,
}: {
  competitionId: string;
  champion: FinalizeChampion | null;
  mvp: FinalizeMvp | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [complete, { loading }] = useMutation(CompleteCompetitionMutation);

  async function onPublish() {
    try {
      await complete({ variables: { id: competitionId } });
      toast.success("Winners published", "The competition is now complete.");
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not finish the competition",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-primary/40 bg-card"
      data-testid="finalize-winners"
    >
      <div className="border-b border-border px-6 py-3">
        <p className="text-sm font-semibold text-primary">
          All matches are played
        </p>
        <p className="text-xs text-muted-foreground">
          Review the winner and MVP below. You can still fix results or the MVP
          formula — nothing is final until you publish.
        </p>
      </div>

      {/* Winner + MVP preview (mirrors the completed overview banner). */}
      <div
        className="grid grid-cols-2 gap-3 p-6"
        style={{
          backgroundImage: "linear-gradient(90deg, #3c0366 0%, #052f4a 100%)",
        }}
      >
        <div className="flex min-w-0 flex-col items-center gap-3">
          <Link
            href={champion?.href ?? "#"}
            className="flex flex-col items-center gap-2 hover:opacity-90"
          >
            <Avatar
              size="xl"
              src={champion?.image ?? undefined}
              fallback={champion?.name ?? "—"}
              shape={champion?.team === false ? "user" : "team"}
            />
            <div className="text-center text-xl font-semibold text-white/90 hover:underline">
              {champion?.name ?? "TBD"}
            </div>
          </Link>
          <span className="text-base font-semibold text-primary">Winner</span>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-3">
          <Link
            href={mvp ? `/players/${mvp.username}` : "#"}
            className="flex flex-col items-center gap-2 hover:opacity-90"
          >
            <Avatar size="xl" src={mvp?.avatarUrl ?? undefined} fallback={mvp?.name ?? "—"} />
            <div className="flex items-center gap-2 text-center text-xl font-semibold text-white/90 hover:underline">
              <span>{mvp?.name ?? "—"}</span>
              {mvp?.nationality ? (
                <CountryFlag code={mvp.nationality} className="text-2xl leading-none" />
              ) : null}
            </div>
          </Link>
          <span className="text-base font-semibold text-primary">MVP</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
        <span className="text-xs text-muted-foreground">
          Publishing marks the competition complete and locks in these results.
        </span>
        <Button
          variant="primary"
          onClick={onPublish}
          loading={loading}
          data-testid="publish-winners"
        >
          Finish &amp; publish winners
        </Button>
      </div>
    </div>
  );
}
