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

// Always relative — the browser is on the same origin that served the page,
// so this works for localhost, custom ports, and tunnel hostnames alike.
const GRAPHQL_URL = "/api/graphql";

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
    // Round-89 — the handler below is async, and the source's `complete`
    // arrives while it is still awaiting the refresh call. Completing the sink
    // right then closed the stream BEFORE `sink.next(result)` ran, so the
    // operation finished having emitted nothing and Apollo synthesised its own
    // generic error — which is what put "An error occurred! … go.apollo.dev"
    // in front of anyone who mistyped their password (login errors carry
    // UNAUTHORIZED, so they take exactly this path) or whose session had
    // expired. Hold completion until the in-flight work is done.
    let sourceCompleted = false;
    let pending = 0;
    const finishIfIdle = () => {
      if (sourceCompleted && pending === 0) sink.complete();
    };
    const sub = forward(operation).subscribe({
      next: (result) => {
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
        pending += 1;
        void (async () => {
          try {
            const ok = await refreshSession();
            if (!ok) {
              sink.next(result);
              return;
            }
            // Retry the original operation against the fresh cookies.
            await new Promise<void>((resolve) => {
              const retrySub = forward(operation).subscribe({
                next: (r) => sink.next(r),
                error: (e) => {
                  sink.error(e);
                  resolve();
                },
                complete: () => resolve(),
              });
              sink.add(() => retrySub.unsubscribe());
            });
          } finally {
            pending -= 1;
            finishIfIdle();
          }
        })();
      },
      error: (e) => sink.error(e),
      complete: () => {
        sourceCompleted = true;
        finishIfIdle();
      },
    });
    return () => sub.unsubscribe();
  });
});

/**
 * Round-89 — carry the server's error message to the UI.
 *
 * Apollo Client 4 hands `useMutation` an error whose `message` is minified in
 * production ("An error occurred! … go.apollo.dev/c/err#…") and which carries
 * no `graphQLErrors` at all — verified against a prod build: own properties are
 * just name/message/stack. So every "couldn't do that" surface in the app was
 * showing users an Apollo debug link instead of "Email or password does not
 * match", and `extractRateLimit` on the sign-in page (which reads
 * `graphQLErrors`) could never find its RATE_LIMITED extension either.
 *
 * The errors are intact here at the link level, so convert a failed mutation
 * result into a real Error that keeps them. Scoped to MUTATIONS on purpose:
 * queries rely on Apollo's errorPolicy handling (several call sites pass
 * `errorPolicy: "ignore"`), and erroring the stream early would defeat it.
 */
const mutationErrorLink = new ApolloLink((operation, forward) => {
  const def = getMainDefinition(operation.query);
  const isMutation =
    def.kind === "OperationDefinition" && def.operation === "mutation";
  if (!isMutation) return forward(operation);
  return new Observable((sink) => {
    const sub = forward(operation).subscribe({
      next: (result) => {
        const errors = result.errors;
        // Only when the mutation produced nothing usable — a partial result
        // with errors still goes through untouched.
        if (Array.isArray(errors) && errors.length > 0 && !result.data) {
          const err = new Error(errors[0]?.message ?? "Request failed") as Error & {
            graphQLErrors?: readonly unknown[];
          };
          err.graphQLErrors = errors;
          sink.error(err);
          return;
        }
        sink.next(result);
      },
      error: (e) => {
        const a = e as any;
        sink.error(e);
      },
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
  const httpWithRefresh = ApolloLink.from([
    mutationErrorLink,
    refreshLink,
    http,
  ]);
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
