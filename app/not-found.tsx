import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="mb-6 inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-black">
        8
      </div>
      <h1 className="text-2xl font-bold md:text-3xl">We racked up the wrong page</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The link you followed doesn't exist anymore — try the dashboard or
        browse competitions.
      </p>
      <div className="mt-6 flex gap-2">
        <Link
          href="/"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85"
        >
          Go to Poolhub
        </Link>
        <Link
          href="/competitions"
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary/40"
        >
          Browse competitions
        </Link>
      </div>
    </main>
  );
}
