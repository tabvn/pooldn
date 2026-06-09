"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the original error in the dev console; production reports it
    // via the error-boundary digest below.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="mb-6 inline-flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive font-black">
        !
      </div>
      <h1 className="text-3xl font-bold">Something cracked</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        We hit an unexpected error. Try again, or head back to the dashboard.
        {error.digest ? (
          <span className="mt-2 block text-xs font-mono opacity-60">
            ref: {error.digest}
          </span>
        ) : null}
      </p>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary/40"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
