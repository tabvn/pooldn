"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { CalendarClock, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalDateTime } from "@/components/ui/local-datetime";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import type { CompetitionStatus } from "@/lib/generated/prisma/enums";
import { CloseApplicationsMutation } from "@/lib/graphql/operations/competition-mutations.operations";
import {
  GenerateMatchdaysMutation,
  PreviewMatchdaysQuery,
} from "@/lib/graphql/operations/matchday.operations";

/**
 * Round-63 — pre-start "Season Calendar" flow.
 *
 * Opens a preview sheet: the organizer sets the games-per-venue cap, reviews
 * the dry-run matchday list (with venues), then Confirms — which closes
 * applications (excluding pending invites) and generates + starts the season.
 * Cancel backs out without touching applications.
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
  const [open, setOpen] = useState(false);
  const [capInput, setCapInput] = useState("1");
  const cap =
    capInput.trim() === ""
      ? null
      : Math.max(1, Math.floor(Number(capInput) || 1));

  const appsOpen = status === "OPEN_FOR_APPLICATIONS";
  const triggerLabel = appsOpen
    ? "Close Applications and Generate Calendar"
    : "Generate Calendar";

  const preview = useQuery(PreviewMatchdaysQuery, {
    variables: { id: competitionId, maxGamesPerVenuePerMatchday: cap },
    skip: !open,
    fetchPolicy: "cache-and-network",
  });
  const [closeApps, closeState] = useMutation(CloseApplicationsMutation);
  const [generate, genState] = useMutation(GenerateMatchdaysMutation);
  const finalizing = closeState.loading || genState.loading;

  const days = preview.data?.previewMatchdays ?? [];
  const unplaced = days.reduce(
    (n, d) => n + d.matches.filter((m) => !m.venueId).length,
    0,
  );

  async function onConfirm() {
    try {
      if (appsOpen) await closeApps({ variables: { id: competitionId } });
      await generate({
        variables: { id: competitionId, maxGamesPerVenuePerMatchday: cap },
      });
      toast.success(
        "Competition is live",
        "Season calendar generated — the competition is now active.",
      );
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not generate the calendar",
        e instanceof Error ? e.message : undefined,
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button data-testid="open-season-preview">{triggerLabel}</Button>}
      />
      <SheetContent side="right" testId="season-calendar-preview">
        <SheetHeader onClose={() => setOpen(false)}>
          <SheetTitle className="text-base font-semibold">
            Preview season calendar
          </SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            Review the matchdays before confirming. Confirm closes applications
            (pending invites/applications are excluded) and starts the
            competition.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-5">
          {/* Max games per venue */}
          <div className="space-y-1.5">
            <label htmlFor="venue-cap" className="text-sm font-semibold">
              Max games per venue (per matchday)
            </label>
            <input
              id="venue-cap"
              type="number"
              min={1}
              value={capInput}
              onChange={(e) => setCapInput(e.target.value)}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:w-40"
              data-testid="venue-cap-input"
            />
            <p className="text-xs text-muted-foreground">
              How many games one venue may host on the same matchday. Keep it at{" "}
              <span className="font-semibold">1</span> so two teams sharing a
              home venue never both host on the same day — the scheduler swaps
              home/away where it can, or leaves a match without a venue for you
              to place. Leave blank for no limit.
            </p>
          </div>

          {/* Dry-run matchday list */}
          <div className="space-y-3" data-testid="season-preview-list">
            {preview.loading && !preview.data ? (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Building preview…
              </p>
            ) : days.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Need at least 2 confirmed teams to build a schedule.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {days.length} matchday{days.length === 1 ? "" : "s"}
                  </span>
                  {unplaced > 0 ? (
                    <span
                      className="rounded bg-warning/15 px-1.5 py-0.5 font-medium text-warning"
                      data-testid="season-preview-unplaced"
                    >
                      {unplaced} without a venue
                    </span>
                  ) : null}
                </div>
                {days.map((d) => (
                  <div
                    key={d.number}
                    className="rounded-lg border border-border bg-background"
                  >
                    <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm font-semibold">
                      <CalendarClock className="size-4 text-muted-foreground" />
                      {d.label}
                      {d.scheduledDate ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          ·{" "}
                          <LocalDateTime value={d.scheduledDate} variant="date" />
                        </span>
                      ) : null}
                    </div>
                    <ul className="divide-y divide-border">
                      {d.matches.map((m, i) => (
                        <li
                          key={i}
                          className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{m.homeTeamName}</span>
                          <span className="text-xs text-muted-foreground">
                            vs
                          </span>
                          <span className="font-medium">{m.awayTeamName}</span>
                          <span className="ml-auto inline-flex items-center gap-1 text-xs">
                            <MapPin className="size-3.5 text-muted-foreground" />
                            {m.venueName ? (
                              <span className="text-muted-foreground">
                                {m.venueName}
                              </span>
                            ) : (
                              <span className="text-warning">
                                No venue — place later
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                      {d.byes.map((b) => (
                        <li
                          key={`bye-${b.teamId}`}
                          className="flex items-center gap-2 px-3 py-2 text-sm"
                          data-testid="season-preview-bye"
                        >
                          <span className="font-medium">{b.teamName}</span>
                          <span className="ml-auto rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                            Bye
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            )}
          </div>
        </SheetBody>

        <SheetFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            data-testid="season-preview-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            loading={finalizing}
            disabled={days.length === 0}
            data-testid="season-preview-confirm"
          >
            {appsOpen ? "Close applications & finalize" : "Finalize calendar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
