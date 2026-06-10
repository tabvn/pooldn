"use client";

import { type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui-components/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Side-anchored sheet (a.k.a. "drawer"). Wraps base-ui's Dialog primitive
 * with shadcn-style slots so any feature can mount a slide-in panel without
 * re-doing the backdrop / focus trap / a11y plumbing.
 *
 * Usage:
 *   <Sheet open={open} onOpenChange={setOpen}>
 *     <SheetTrigger render={<Button>Open</Button>} />
 *     <SheetContent side="right">
 *       <SheetHeader>
 *         <SheetTitle>Title</SheetTitle>
 *         <SheetDescription>...</SheetDescription>
 *       </SheetHeader>
 *       <SheetBody>...</SheetBody>
 *       <SheetFooter>...</SheetFooter>
 *     </SheetContent>
 *   </Sheet>
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;
export const SheetClose = DialogPrimitive.Close;

const sideClasses: Record<"right" | "left" | "top" | "bottom", string> = {
  right:
    "right-0 top-0 h-full w-[720px] max-w-[96vw] border-l " +
    "data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
  left:
    "left-0 top-0 h-full w-[720px] max-w-[96vw] border-r " +
    "data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full",
  top:
    "top-0 left-0 w-full max-h-[92vh] border-b " +
    "data-[ending-style]:-translate-y-full data-[starting-style]:-translate-y-full",
  bottom:
    "bottom-0 left-0 w-full max-h-[92vh] border-t " +
    "data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
};

export function SheetContent({
  side = "right",
  className,
  children,
  testId,
}: {
  side?: "right" | "left" | "top" | "bottom";
  className?: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 " +
          "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
        }
      />
      <DialogPrimitive.Popup
        data-testid={testId}
        className={cn(
          "fixed z-50 flex flex-col bg-card text-card-foreground shadow-xl outline-none " +
            "transition-transform duration-200 ease-out",
          sideClasses[side],
          className,
        )}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({
  children,
  className,
  onClose,
}: {
  children: ReactNode;
  className?: string;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-border p-5",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      ) : (
        <SheetClose
          render={
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          }
        />
      )}
    </div>
  );
}

export function SheetBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto p-5", className)}>
      {children}
    </div>
  );
}

export function SheetFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-border p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
