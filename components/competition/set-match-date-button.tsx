"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { CalendarPlus, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { errorText } from "@/lib/apollo/error-message";
import { UpdateMatchScheduleMutation } from "@/lib/graphql/operations/match.operations";

/**
 * Round-92 — put a date on one fixture, from the Free Schedule list.
 *
 * In that mode every match starts undated and gets its date when the two sides
 * agree one, so dating happens here rather than in the season calendar. Reuses
 * the existing organizer-only `updateMatchSchedule` — no new mutation, no new
 * permission. It refuses COMPLETED matches server-side, so the caller hides
 * this control for those.
 */
export function SetMatchDateButton({
  matchId,
  scheduledAt,
}: {
  matchId: string;
  scheduledAt: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [save, { loading }] = useMutation(UpdateMatchScheduleMutation);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) {
      toast.error("Pick a date", "Choose when this match will be played.");
      return;
    }
    try {
      await save({
        variables: { id: matchId, scheduledAt: new Date(value).toISOString() },
      });
      toast.success(scheduledAt ? "Date updated" : "Date set");
      setOpen(false);
      setValue("");
      router.refresh();
    } catch (err) {
      toast.error("Could not set the date", errorText(err, "Try again."));
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          // Seed the picker with the current value, trimmed to the
          // `datetime-local` format (no seconds, no timezone suffix).
          setValue(scheduledAt ? new Date(scheduledAt).toISOString().slice(0, 16) : "");
          setOpen(true);
        }}
        data-testid={`set-date-${matchId}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <CalendarPlus className="size-3.5" />
        {scheduledAt ? "Change" : "Set date"}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex shrink-0 items-center gap-1">
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        data-testid={`set-date-input-${matchId}`}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={loading}
        aria-label="Save date"
        className="inline-flex size-8 items-center justify-center rounded-md border border-border text-primary hover:bg-primary/10 disabled:opacity-50"
      >
        <Check className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Cancel"
        className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary"
      >
        <X className="size-4" />
      </button>
    </form>
  );
}
