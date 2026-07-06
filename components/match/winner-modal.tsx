"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui-components/react/dialog";
import { Check, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";

export type WinnerParticipant = {
  /** "Name" for singles, "A & B" for doubles (used for the avatar fallback). */
  label: string;
  /** One entry for singles, two for a doubles couple — rendered stacked. */
  names: string[];
  avatarUrl?: string | null;
  nationality?: string | null;
};

/**
 * Figma "Select Winner" modal (node 492:13287). Pick the winning side via a
 * radio, optionally flag Break & Run, then Confirm. Reused for every game
 * card once its block is published.
 */
export function WinnerModal({
  open,
  onClose,
  home,
  away,
  initialWinner,
  initialBreakAndRun,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  home: WinnerParticipant;
  away: WinnerParticipant;
  initialWinner: "home" | "away" | null;
  initialBreakAndRun: boolean;
  onConfirm: (winner: "home" | "away", breakAndRun: boolean) => Promise<void>;
}) {
  const [winner, setWinner] = useState<"home" | "away" | null>(initialWinner);
  const [br, setBr] = useState(initialBreakAndRun);
  const [saving, setSaving] = useState(false);

  // Re-seed when the modal is (re)opened for a different frame.
  useEffect(() => {
    if (open) {
      setWinner(initialWinner);
      setBr(initialBreakAndRun);
      setSaving(false);
    }
  }, [open, initialWinner, initialBreakAndRun]);

  async function confirm() {
    if (!winner) return;
    setSaving(true);
    try {
      await onConfirm(winner, br);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Popup
          data-testid="winner-modal"
          className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none"
        >
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title className="text-base font-semibold">
              Select Winner
            </DialogPrimitive.Title>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Stacked full-width rows — a doubles side ("A & B") gets the whole
              width to wrap onto, and the layout stays comfortable on mobile. */}
          <div className="mt-4 flex flex-col gap-2">
            <WinnerChoice
              p={home}
              selected={winner === "home"}
              onSelect={() => setWinner("home")}
            />
            <span className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              vs
            </span>
            <WinnerChoice
              p={away}
              selected={winner === "away"}
              onSelect={() => setWinner("away")}
            />
          </div>

          <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={br}
              onChange={(e) => setBr(e.target.checked)}
              className="size-4 accent-primary"
            />
            Break &amp; Run (B&amp;R)
          </label>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={confirm}
              disabled={!winner}
              loading={saving}
              data-testid="winner-modal-confirm"
            >
              Confirm
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function WinnerChoice({
  p,
  selected,
  onSelect,
}: {
  p: WinnerParticipant;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex w-full items-center gap-2.5 rounded-lg border px-3 py-3 text-left transition-colors ${
        selected
          ? "border-[#46ecd5] bg-[#005f5a]/30"
          : "border-border hover:border-border/80"
      }`}
    >
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-[#46ecd5] bg-[#46ecd5] text-[#04241c]" : "border-muted-foreground"
        }`}
      >
        {selected ? <Check className="size-3" /> : null}
      </span>
      <Avatar size="sm" src={p.avatarUrl ?? undefined} fallback={p.label} className="size-7 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm font-medium leading-snug break-words">
        {p.names.map((n, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            {n}
            {p.names.length === 1 && p.nationality ? (
              <CountryFlag code={p.nationality} className="leading-none" />
            ) : null}
          </span>
        ))}
      </span>
      {selected ? (
        <span className="shrink-0 rounded bg-[#005f5a] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#96f7e4]">
          Winner
        </span>
      ) : null}
    </button>
  );
}
