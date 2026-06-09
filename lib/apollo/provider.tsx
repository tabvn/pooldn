"use client";

import type { ReactNode } from "react";
import { ApolloLink, HttpLink, Observable, split } from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import {
  ApolloClient,
  ApolloNextAppProvider,
  InMemoryCache,
} from "@apollo/client-integration-nextjs";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { SSELink } from "./sse-link";

const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "/api/graphql";

/**
 * Round-44 — refresh link.
 *
 * When the server returns an UNAUTHORIZED extension code (the access cookie
 * expired), we call /api/auth/refresh to rotate the cookie pair and then
 * re-run the original operation EXACTLY ONCE. Single-flight via a module
 * promise so a burst of N concurrent expirations triggers one refresh.
 */
let refreshInFlight: Promise<boolean> | null = null;
async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const r = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();
  return refreshInFlight;
}

const refreshLink = new ApolloLink((operation, forward) => {
  return new Observable((sink) => {
    let retried = false;
    const sub = forward(operation).subscribe({
      next: async (result) => {
        const needsRefresh =
          !retried &&
          Array.isArray(result.errors) &&
          result.errors.some(
            (e) =>
              (e.extensions as { code?: string } | undefined)?.code ===
              "UNAUTHORIZED",
          );
        if (!needsRefresh) {
          sink.next(result);
          return;
        }
        retried = true;
        const ok = await refreshSession();
        if (!ok) {
          sink.next(result);
          return;
        }
        // Retry the original operation against the fresh cookies.
        const retrySub = forward(operation).subscribe({
          next: (r) => sink.next(r),
          error: (e) => sink.error(e),
          complete: () => sink.complete(),
        });
        sink.add(() => retrySub.unsubscribe());
      },
      error: (e) => sink.error(e),
      complete: () => sink.complete(),
    });
    return () => sub.unsubscribe();
  });
});

function makeClient(): ApolloClient {
  // Subscriptions ride the SSE link; queries + mutations stay on plain HTTP.
  // refreshLink sits between the split and the transport so it catches
  // both query+mutation failures (subscriptions use their own connect path).
  const http = new HttpLink({ uri: GRAPHQL_URL, credentials: "include" });
  const sse = new SSELink(GRAPHQL_URL);
  const httpWithRefresh = ApolloLink.from([refreshLink, http]);
  const link = split(
    ({ query }) => {
      const def = getMainDefinition(query);
      return def.kind === "OperationDefinition" && def.operation === "subscription";
    },
    sse,
    httpWithRefresh,
  );
  return new ApolloClient({
    cache: new InMemoryCache(),
    link,
  });
}

export function ApolloWrapper({ children }: { children: ReactNode }) {
  return (
    <ApolloNextAppProvider makeClient={makeClient}>
      <ToastProvider>
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
      </ToastProvider>
    </ApolloNextAppProvider>
  );
}
