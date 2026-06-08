"use client";

import * as React from "react";
import { Toast as ToastPrimitive } from "@base-ui-components/react/toast";

const useToastManager = ToastPrimitive.useToastManager;
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const TOAST_DURATION = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastPrimitive.Provider timeout={TOAST_DURATION}>
      {children}
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 flex w-[min(380px,100vw)] flex-col-reverse gap-2">
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  );
}

const iconForType = {
  success: <CheckCircle2 className="size-4 text-success" />,
  error: <XCircle className="size-4 text-destructive" />,
  info: <Info className="size-4 text-info" />,
} as const;

function ToastList() {
  const { toasts } = useToastManager();
  return (
    <>
      {toasts.map((toast) => {
        const kind = (toast.data as { kind?: keyof typeof iconForType })?.kind ?? "info";
        return (
          <ToastPrimitive.Root
            key={toast.id}
            toast={toast}
            className={cn(
              "pointer-events-auto rounded-lg border bg-card px-4 py-3 shadow-2xl",
              "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
              "transition-all border-border",
            )}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0">{iconForType[kind]}</span>
              <div className="flex-1 min-w-0">
                <ToastPrimitive.Title className="text-sm font-semibold">
                  {toast.title}
                </ToastPrimitive.Title>
                {toast.description ? (
                  <ToastPrimitive.Description className="text-xs text-muted-foreground mt-0.5">
                    {toast.description}
                  </ToastPrimitive.Description>
                ) : null}
              </div>
              <ToastPrimitive.Close
                aria-label="Dismiss"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </ToastPrimitive.Close>
            </div>
          </ToastPrimitive.Root>
        );
      })}
    </>
  );
}

/**
 * `useToast()` — call `toast.success(...)`, `toast.error(...)`, `toast.info(...)`
 * from any client component.
 */
export function useToast() {
  const manager = useToastManager();
  return {
    success: (title: string, description?: string) =>
      manager.add({ title, description, data: { kind: "success" } }),
    error: (title: string, description?: string) =>
      manager.add({ title, description, data: { kind: "error" } }),
    info: (title: string, description?: string) =>
      manager.add({ title, description, data: { kind: "info" } }),
  };
}
