import Link from "next/link";
import { VerifyEmailClient } from "./client";

export const dynamic = "force-dynamic";

/**
 * Round-47 — destination for the verification link in outbound emails.
 * Lives outside any auth/route group so a signed-out user can also land
 * here from their inbox.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
        <h1 className="text-2xl font-bold">Confirm your email</h1>
        {token ? (
          <VerifyEmailClient token={token} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              This link is missing a verification token. Open the most recent
              "Confirm your PoolDN email" message and tap the button there.
            </p>
            <Link
              href="/"
              className="inline-block rounded-md bg-secondary/40 px-4 py-2 text-sm font-semibold hover:bg-secondary"
            >
              Back to PoolDN
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
