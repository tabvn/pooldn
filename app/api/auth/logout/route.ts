import { NextResponse } from "next/server";
import { clearRefreshCookie, clearSessionCookie } from "@/lib/auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Round-46 — plain POST endpoint to clear the session + refresh cookies,
 * used by the /banned screen's "Sign out" form so we don't need a JS
 * client. Returns a 303 redirect to /sign-in so the browser follows.
 */
export async function POST() {
  const res = NextResponse.redirect(new URL("/sign-in", "http://localhost"), {
    status: 303,
  });
  // Override the URL host so it works from any deployment origin without
  // baking it into the bundle.
  res.headers.set("location", "/sign-in");
  res.headers.append("set-cookie", clearSessionCookie());
  res.headers.append("set-cookie", clearRefreshCookie());
  return res;
}
