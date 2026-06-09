"use client";

import { ApolloLink, Observable, type Operation, type FetchResult } from "@apollo/client";
import { print } from "graphql";

/**
 * Minimal GraphQL-over-SSE subscription link.
 *
 * GraphQL Yoga's subscription transport is HTTP + `Accept: text/event-stream`
 * (the graphql-sse spec). The server keeps the connection open and emits one
 * SSE `data: {...}` line per payload. This link converts that into the
 * Observable Apollo Client expects.
 *
 * We POST the operation (so it survives long query bodies) and stream the
 * response body line-by-line via the fetch ReadableStream.
 */
export class SSELink extends ApolloLink {
  constructor(private readonly url: string) {
    super();
  }

  request(operation: Operation): Observable<FetchResult> {
    return new Observable((sink) => {
      const ctrl = new AbortController();
      const body = JSON.stringify({
        query: print(operation.query),
        variables: operation.variables,
        operationName: operation.operationName,
      });
      (async () => {
        try {
          const res = await fetch(this.url, {
            method: "POST",
            credentials: "include",
            signal: ctrl.signal,
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
            },
            body,
          });
          if (!res.ok || !res.body) {
            sink.error(new Error(`SSE link: HTTP ${res.status}`));
            return;
          }
          const reader = res.body
            .pipeThrough(new TextDecoderStream())
            .getReader();
          let buf = "";
          while (!ctrl.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += value;
            // SSE events are separated by a blank line.
            let idx: number;
            while ((idx = buf.indexOf("\n\n")) !== -1) {
              const raw = buf.slice(0, idx);
              buf = buf.slice(idx + 2);
              // Each event is one or more `field: value` lines.
              const lines = raw.split("\n");
              let event = "next";
              const dataLines: string[] = [];
              for (const line of lines) {
                if (line.startsWith("event:")) {
                  event = line.slice(6).trim();
                } else if (line.startsWith("data:")) {
                  dataLines.push(line.slice(5).trim());
                }
              }
              if (event === "complete") {
                sink.complete();
                return;
              }
              if (dataLines.length === 0) continue;
              try {
                const payload = JSON.parse(dataLines.join("\n"));
                sink.next(payload);
              } catch {
                // Ignore malformed payloads (keep-alives / blank pings).
              }
            }
          }
          sink.complete();
        } catch (err) {
          if ((err as { name?: string }).name !== "AbortError") sink.error(err);
        }
      })();
      return () => ctrl.abort();
    });
  }
}
