"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Dialog as DialogPrimitive } from "@base-ui-components/react/dialog";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ShiftMatchdayMutation } from "@/lib/graphql/operations/matchday.operations";

function toDateInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Round-64 — organizer control to push a matchday to a new date. The moved
 * matchday and every LATER one re-slot forward onto the league's configured
 * weekdays (e.g. Tue/Thu stays Tue/Thu), so a gap (holiday, clash, …)
 * propagates through the schedule without breaking the weekday pattern.
 */
export function MoveMatchdayButton({
  matchdayId,
  number,
  scheduledDate,
}: {
  matchdayId: string;
  number: number;
  scheduledDate: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(
    scheduledDate ? toDateInput(scheduledDate) : "",
  );
  const [note, setNote] = useState("");
  const [shift, { loading }] = useMutation(ShiftMatchdayMutation);

  // A matchday with no date can't be moved by a delta.
  if (!scheduledDate) return null;

  async function onMove() {
    const orig = new Date(scheduledDate!);
    const [y, m, d] = date.split("-").map(Number);
    if (!y || !m || !d) {
      toast.error("Pick a date");
      return;
    }
    const next = new Date(orig);
    next.setFullYear(y, m - 1, d); // keep time-of-day, move the calendar day
    if (next.getTime() === orig.getTime()) {
      toast.error("Pick a different date");
      return;
    }
    try {
      await shift({
        variables: {
          matchdayId,
          scheduledDate: next.toISOString(),
          note: note.trim() || null,
        },
      });
      toast.success(
        "Matchday moved",
        "Later matchdays were shifted to keep the gap.",
      );
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not move matchday",
        e instanceof Error ? e.message : undefined,
      );
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10"
            data-testid={`move-matchday-${number}`}
          >
            <CalendarClock className="size-3.5" />
            Move
          </button>
        }
      />
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none">
          <DialogPrimitive.Title className="text-base font-semibold">
            Move Matchday {number}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            Pick a new date. Later matchdays re-slot forward onto the
            competition&rsquo;s weekdays so the gap is preserved.
          </DialogPrimitive.Description>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="md-date" className="text-sm font-medium">
                New date
              </label>
              <input
                id="md-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                data-testid="move-matchday-date"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="md-note" className="text-sm font-medium">
                Note (optional)
              </label>
              <textarea
                id="md-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. National holiday — venues closed"
                className="block w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                data-testid="move-matchday-note"
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onMove}
              loading={loading}
              data-testid="move-matchday-confirm"
            >
              Move &amp; reschedule
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
