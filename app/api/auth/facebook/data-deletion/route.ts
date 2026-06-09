import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/auth/origin";

export const runtime = "nodejs";

/**
 * Not used as a Facebook Data Deletion *callback*. We register the Data
 * Deletion *Instructions URL* (`/data-deletion`) instead, so this endpoint
 * just forwards there for anyone who hits it directly.
 */
function to(request: Request) {
  return NextResponse.redirect(new URL("/data-deletion", appOrigin(request)));
}

export const GET = to;
export const POST = to;
