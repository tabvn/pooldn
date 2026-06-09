import { NextResponse } from "next/server";
import {
  buildAuthUrl,
  googleConfigured,
  makePkce,
  randomToken,
  redirectUriFor,
} from "@/lib/auth/google";
import { appOrigin } from "@/lib/auth/origin";

export const runtime = "nodejs";

const TEN_MIN = 60 * 10;

/** Only allow same-origin relative redirects (prevents open-redirect). */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin(request);

  if (!googleConfigured()) {
    return NextResponse.redirect(
      new URL("/sign-in?authError=google_unconfigured", origin),
    );
  }

  const state = randomToken();
  const nonce = randomToken();
  const { verifier, challenge } = makePkce();
  const next = safeNext(url.searchParams.get("next"));

  const authUrl = buildAuthUrl({
    redirectUri: redirectUriFor(origin),
    state,
    nonce,
    codeChallenge: challenge,
  });

  const res = NextResponse.redirect(authUrl);
  const secure = process.env.NODE_ENV === "production";
  const opts = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: TEN_MIN,
  };
  res.cookies.set("g_state", state, opts);
  res.cookies.set("g_nonce", nonce, opts);
  res.cookies.set("g_verifier", verifier, opts);
  res.cookies.set("g_next", next, opts);
  return res;
}
