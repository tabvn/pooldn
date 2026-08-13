"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Dialog as DialogPrimitive } from "@base-ui-components/react/dialog";
import { Calculator, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { UpdateMvpConfigMutation } from "@/lib/graphql/operations/competition.operations";

export type MvpConfig = {
  ptAppearance: number;
  ptSinglesWon: number;
  ptDoublesWon: number;
  ptBreakRun: number;
  minAppearancePct: number;
};

/** Trimmed player stats the preview needs to re-rank live. */
export type MvpPreviewPlayer = {
  name: string;
  appearanceMatchdays: number;
  teamMatchdays: number;
  framesPlayed: number;
  singlesWon: number;
  doublesWon: number;
  brWon: number;
};

const appearancePct = (p: MvpPreviewPlayer) =>
  p.teamMatchdays > 0 ? (p.appearanceMatchdays / p.teamMatchdays) * 100 : 0;

/**
 * Round-65 — the organizer's MVP "calculator". A modal with a point weight per
 * parameter (appearances, singles won, doubles won, B&R) and a minimum
 * appearance % required to be ranked. The preview re-ranks the roster live as
 * the weights change; Save persists the formula and recomputes the rating.
 */
export function MvpCalculator({
  competitionId,
  initial,
  players,
  locked = false,
}: {
  competitionId: string;
  initial: MvpConfig;
  players: MvpPreviewPlayer[];
  // Round-72 — once the competition is COMPLETED the formula is frozen; the
  // calculator opens read-only.
  locked?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<MvpConfig>(initial);
  const [save, { loading }] = useMutation(UpdateMvpConfigMutation);

  // Re-seed the inputs whenever the modal (re)opens, so a cancelled edit is
  // discarded rather than lingering.
  function onOpenChange(next: boolean) {
    if (next) setCfg(initial);
    setOpen(next);
  }

  const preview = useMemo(() => {
    const scored = players.map((p) => ({
      name: p.name,
      pct: appearancePct(p),
      played: p.framesPlayed > 0,
      score:
        p.appearanceMatchdays * cfg.ptAppearance +
        p.singlesWon * cfg.ptSinglesWon +
        p.doublesWon * cfg.ptDoublesWon +
        p.brWon * cfg.ptBreakRun,
    }));
    const eligible = scored
      .filter((p) => p.played && p.pct >= cfg.minAppearancePct)
      .sort((a, b) => b.score - a.score);
    const excluded = scored.length - eligible.length;
    return { eligible, excluded };
  }, [players, cfg]);

  const num = (key: keyof MvpConfig, label: string, max = 999) => (
    <div className="space-y-1">
      <Label htmlFor={`mvp-${key}`}>{label}</Label>
      <Input
        id={`mvp-${key}`}
        type="number"
        min={0}
        max={max}
        disabled={locked}
        value={String(cfg[key])}
        onChange={(e) => {
          const v = Math.max(0, Math.min(max, Math.round(Number(e.target.value) || 0)));
          setCfg((c) => ({ ...c, [key]: v }));
        }}
      />
    </div>
  );

  async function onSave() {
    try {
      await save({ variables: { id: competitionId, input: cfg } });
      toast.success("MVP rating updated", "The rating has been recalculated.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not update rating",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onOpenChange(true)}
        data-testid="mvp-calculator-open"
      >
        <Calculator className="size-4" />
        Rating calculator
      </Button>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Popup
          data-testid="mvp-calculator"
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[560px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xl outline-none"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <DialogPrimitive.Title className="text-base font-semibold">
              MVP rating calculator
            </DialogPrimitive.Title>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <p className="text-xs text-muted-foreground">
              Points awarded per stat, then a minimum appearance % to be ranked.
              Score = Appearances × pts + Singles Won × pts + Doubles Won × pts +
              B&amp;R × pts.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {num("ptAppearance", "Appearance")}
              {num("ptSinglesWon", "Singles Won")}
              {num("ptDoublesWon", "Doubles Won")}
              {num("ptBreakRun", "B&R")}
            </div>
            <div className="max-w-[240px]">
              {num("minAppearancePct", "Min % required to be in the rating", 100)}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Appearance % = matchdays the player showed up ÷ matchdays their
                team played. Players below this stay in the table but aren&apos;t
                ranked.
              </p>
            </div>

            {/* Live preview */}
            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-semibold">
                <span>Preview ranking</span>
                {preview.excluded > 0 ? (
                  <span className="text-muted-foreground">
                    {preview.excluded} not ranked
                  </span>
                ) : null}
              </div>
              {preview.eligible.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No players meet the threshold yet.
                </p>
              ) : (
                <ol className="max-h-52 overflow-y-auto">
                  {preview.eligible.slice(0, 12).map((p, i) => (
                    <li
                      key={p.name + i}
                      className="flex items-center justify-between px-3 py-1.5 text-sm even:bg-white/[0.02]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{p.score}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
            {locked ? (
              <span className="mr-auto text-xs text-muted-foreground">
                The competition is complete — the rating formula is locked.
              </span>
            ) : null}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {locked ? "Close" : "Cancel"}
            </Button>
            {!locked ? (
              <Button
                variant="primary"
                onClick={onSave}
                loading={loading}
                data-testid="mvp-calculator-save"
              >
                Save &amp; recalculate
              </Button>
            ) : null}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
