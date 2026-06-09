import { NextResponse } from "next/server";
import {
  buildAuthUrl,
  facebookConfigured,
  randomToken,
  redirectUriFor,
} from "@/lib/auth/facebook";

export const runtime = "nodejs";

const TEN_MIN = 60 * 10;

function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  if (!facebookConfigured()) {
    return NextResponse.redirect(
      new URL("/sign-in?authError=facebook_unconfigured", origin),
    );
  }

  const state = randomToken();
  const next = safeNext(url.searchParams.get("next"));

  const authUrl = buildAuthUrl({
    redirectUri: redirectUriFor(origin),
    state,
  });

  const res = NextResponse.redirect(authUrl);
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TEN_MIN,
  };
  res.cookies.set("fb_state", state, opts);
  res.cookies.set("fb_next", next, opts);
  return res;
}
