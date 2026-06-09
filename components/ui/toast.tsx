"use client";

import * as React from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { friendlyError } from "@/lib/errors/friendly";

/**
 * App-wide toast surface, powered by Sonner.
 *
 * `useToast()` is kept as the call site so existing components don't need to
 * change — `toast.success(title, description?)` etc. routes into Sonner.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SonnerToaster
        position="bottom-right"
        richColors
        closeButton
        theme="dark"
        toastOptions={{
          // Match the PoolDN card aesthetic.
          className:
            "!bg-card !text-foreground !border-border !shadow-2xl rounded-lg",
        }}
      />
    </>
  );
}

export function useToast() {
  return React.useMemo(
    () => ({
      success: (title: string, description?: string) =>
        sonnerToast.success(title, description ? { description } : undefined),
      /**
       * Pass a raw string OR an Error / ApolloError / unknown — if it's an
       * Error, we strip Prisma noise and map known GraphQL extension codes to
       * human-readable text (lib/errors/friendly.ts).
       */
      error: (title: string, description?: string | unknown) => {
        let body: string | undefined;
        if (typeof description === "string" || description === undefined) {
          body = description;
        } else {
          body = friendlyError(description);
        }
        sonnerToast.error(title, body ? { description: body } : undefined);
      },
      info: (title: string, description?: string) =>
        sonnerToast.message(title, description ? { description } : undefined),
    }),
    [],
  );
}
