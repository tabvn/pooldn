import { cookies } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { readSessionCookie, verifySessionToken } from "@/lib/auth/jwt";

export const dynamic = "force-dynamic";

/**
 * Round-46 — the destination page for banned users.
 *
 * The middleware redirects every other route here. We read the session
 * cookie SSR-side (no GraphQL — that returns null for banned users) and
 * show the reason if one was set. The only way out is to clear cookies
 * (Sign out button).
 */
export default async function BannedPage() {
  const cookieStore = await cookies();
  const token = readSessionCookie(`pooldn_session=${
    cookieStore.get("pooldn_session")?.value ?? ""
  }`);
  let reason: string | null = null;
  let name: string | null = null;
  if (token) {
    const claims = await verifySessionToken(token);
    if (claims?.sub) {
      const u = await prisma.user.findUnique({
        where: { id: claims.sub },
        select: { name: true, banReason: true },
      });
      reason = u?.banReason ?? null;
      name = u?.name ?? null;
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md w-full rounded-2xl border border-destructive/30 bg-card p-6 text-center space-y-4 shadow-xl">
        <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive text-2xl">
          🚫
        </div>
        <h1 className="text-2xl font-bold text-destructive">
          Your account is banned
        </h1>
        {name ? (
          <p className="text-sm text-muted-foreground">{name}</p>
        ) : null}
        {reason ? (
          <p className="rounded-md border border-border bg-background px-3 py-2 text-sm">
            <span className="font-semibold">Reason: </span>
            {reason}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            You can't sign in, view, or post. Contact support if you think
            this is a mistake.
          </p>
        )}
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full rounded-md border border-border bg-secondary/40 px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            Sign out
          </button>
        </form>
        <Link
          href="mailto:support@pooldn.app"
          className="block text-xs text-muted-foreground hover:text-foreground"
        >
          support@pooldn.app
        </Link>
      </div>
    </div>
  );
}
