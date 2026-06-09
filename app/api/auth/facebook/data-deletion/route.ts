import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Not used as a Facebook Data Deletion *callback*. We register the Data
 * Deletion *Instructions URL* (`/data-deletion`) instead, so this endpoint
 * just forwards there for anyone who hits it directly.
 */
function to(request: Request) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.redirect(new URL("/data-deletion", origin));
}

export const GET = to;
export const POST = to;
