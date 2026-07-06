"use client";

import { useState, useCallback, useEffect } from "react";
import { Dialog as DialogPrimitive } from "@base-ui-components/react/dialog";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  description?: string;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Use the destructive style on the confirm button. */
  destructive?: boolean;
};

export type PromptOptions = ConfirmOptions & {
  /** Label rendered above the textarea. */
  inputLabel?: string;
  /** Placeholder text in the textarea. */
  inputPlaceholder?: string;
  /** Required → confirm stays disabled until the user types a non-empty value. */
  required?: boolean;
  /** Prefilled value. */
  defaultValue?: string;
};

type ResolveFn = (ok: boolean) => void;
type PromptResolveFn = (value: string | null) => void;
type Opener = (opts: ConfirmOptions) => Promise<boolean>;
type PromptOpener = (opts: PromptOptions) => Promise<string | null>;

let cachedOpener: Opener | null = null;
let cachedPromptOpener: PromptOpener | null = null;

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [pendingResolve, setPendingResolve] = useState<ResolveFn | null>(null);

  // Prompt dialog (separate state so a confirm + prompt don't fight).
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptOpts, setPromptOpts] = useState<PromptOptions | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [pendingPromptResolve, setPendingPromptResolve] =
    useState<PromptResolveFn | null>(null);

  const opener = useCallback<Opener>((o) => {
    return new Promise<boolean>((resolve) => {
      setOpts(o);
      setPendingResolve(() => resolve);
      setOpen(true);
    });
  }, []);

  const promptOpener = useCallback<PromptOpener>((o) => {
    return new Promise<string | null>((resolve) => {
      setPromptOpts(o);
      setPromptValue(o.defaultValue ?? "");
      setPendingPromptResolve(() => resolve);
      setPromptOpen(true);
    });
  }, []);

  // Publish the opener to the module so any client component can call
  // `useConfirm()` and route through this single provider instance.
  useEffect(() => {
    cachedOpener = opener;
    cachedPromptOpener = promptOpener;
    return () => {
      if (cachedOpener === opener) cachedOpener = null;
      if (cachedPromptOpener === promptOpener) cachedPromptOpener = null;
    };
  }, [opener, promptOpener]);

  function resolveWith(ok: boolean) {
    if (pendingResolve) pendingResolve(ok);
    setPendingResolve(null);
    setOpen(false);
    setOpts(null);
  }

  function resolvePromptWith(value: string | null) {
    if (pendingPromptResolve) pendingPromptResolve(value);
    setPendingPromptResolve(null);
    setPromptOpen(false);
    setPromptOpts(null);
    setPromptValue("");
  }

  return (
    <>
      {children}
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(o) => {
          if (!o) resolveWith(false);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <DialogPrimitive.Popup
            data-testid="confirm-dialog"
            className="fixed left-1/2 top-1/2 z-50 w-[400px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={
                  "mt-0.5 inline-flex size-9 items-center justify-center rounded-full " +
                  (opts?.destructive
                    ? "bg-destructive/15 text-destructive"
                    : "bg-secondary text-foreground")
                }
              >
                {opts?.destructive ? (
                  <AlertTriangle className="size-5" />
                ) : (
                  <Info className="size-5" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <DialogPrimitive.Title className="text-base font-semibold">
                  {opts?.title}
                </DialogPrimitive.Title>
                {opts?.description ? (
                  <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                    {opts.description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => resolveWith(false)}
                data-testid="confirm-dialog-cancel"
              >
                {opts?.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={opts?.destructive ? "danger" : "primary"}
                onClick={() => resolveWith(true)}
                data-testid="confirm-dialog-ok"
              >
                {opts?.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root
        open={promptOpen}
        onOpenChange={(o) => {
          if (!o) resolvePromptWith(null);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <DialogPrimitive.Popup
            data-testid="prompt-dialog"
            className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={
                  "mt-0.5 inline-flex size-9 items-center justify-center rounded-full " +
                  (promptOpts?.destructive
                    ? "bg-destructive/15 text-destructive"
                    : "bg-secondary text-foreground")
                }
              >
                {promptOpts?.destructive ? (
                  <AlertTriangle className="size-5" />
                ) : (
                  <Info className="size-5" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <DialogPrimitive.Title className="text-base font-semibold">
                  {promptOpts?.title}
                </DialogPrimitive.Title>
                {promptOpts?.description ? (
                  <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                    {promptOpts.description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
            </div>
            <label className="mt-4 block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {promptOpts?.inputLabel ?? "Reason"}
                {promptOpts?.required ? (
                  <span className="text-destructive"> *</span>
                ) : null}
              </span>
              <textarea
                autoFocus
                rows={3}
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptOpts?.inputPlaceholder}
                data-testid="prompt-dialog-input"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none focus:border-primary"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => resolvePromptWith(null)}
                data-testid="prompt-dialog-cancel"
              >
                {promptOpts?.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={promptOpts?.destructive ? "danger" : "primary"}
                disabled={
                  !!promptOpts?.required && promptValue.trim().length === 0
                }
                onClick={() => resolvePromptWith(promptValue.trim())}
                data-testid="prompt-dialog-ok"
              >
                {promptOpts?.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

/**
 * Hook form. Returns a `confirm(opts) => Promise<boolean>` that pops the
 * single shared dialog. Render `<ConfirmDialogProvider>` once near the root.
 */
export function useConfirm() {
  return (opts: ConfirmOptions): Promise<boolean> => {
    if (!cachedOpener) {
      // No provider in scope — fall back to native confirm so callers never
      // silently lose their guardrail.
      return Promise.resolve(
        typeof window !== "undefined" ? window.confirm(opts.title) : false,
      );
    }
    return cachedOpener(opts);
  };
}

/**
 * Hook form of the prompt dialog — pops a textarea-based dialog that resolves
 * to the entered string (trimmed) or `null` if cancelled. Used for capturing
 * a ban reason, dismissal note, etc.
 */
export function usePrompt() {
  return (opts: PromptOptions): Promise<string | null> => {
    if (!cachedPromptOpener) {
      if (typeof window === "undefined") return Promise.resolve(null);
      const v = window.prompt(opts.title, opts.defaultValue ?? "");
      return Promise.resolve(v === null ? null : v.trim());
    }
    return cachedPromptOpener(opts);
  };
}
