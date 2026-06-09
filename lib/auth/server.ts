import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getClient } from "@/lib/apollo/client";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";

export type Viewer = NonNullable<
  Awaited<ReturnType<typeof getClient> extends infer C
    ? C extends { query: (args: never) => Promise<infer R> }
      ? R
      : never
    : never>
>;

export async function getViewer() {
  const { data } = await getClient().query({
    query: ViewerQuery,
    errorPolicy: "ignore",
  });
  return data?.viewer ?? null;
}

/**
 * Round-47 — server-component ban check, replacing the proxy/middleware
 * approach. Peeks the access JWT's `b` claim from the cookie. If true,
 * redirect to /banned so the user lands on the lockout screen.
 *
 * Called from the (shell) layout; /banned itself lives outside the (shell)
 * group, so this can't loop on its own destination. We trust the cookie
 * payload (no signature verify) because the GraphQL context separately
 * drops `viewer` to null when bannedAt is set — every authenticated API
 * op still refuses, so a forged `b: false` claim buys nothing.
 *
 * Pass the unused `_` arg to keep the call site explicit at the layout.
 */
export async function redirectIfBanned(_: string = ""): Promise<void> {
  void _;
  const cookieStore = await cookies();
  const token = cookieStore.get("pooldn_session")?.value;
  if (!token) return;
  const seg = token.split(".")[1];
  if (!seg) return;
  try {
    const json = JSON.parse(
      Buffer.from(seg.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    ) as { sub?: string; b?: boolean };
    if (json.b === true) {
      redirect("/banned");
    }
  } catch {
    // Bad cookie — let the regular auth flow handle it.
  }
}

export async function requireViewer({
  next,
  roles,
}: { next?: string; roles?: readonly string[] } = {}) {
  const viewer = await getViewer();
  if (!viewer) {
    const param = next ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/sign-in${param}`);
  }
  if (roles && !roles.includes(viewer.role)) {
    redirect("/");
  }
  return viewer;
}
