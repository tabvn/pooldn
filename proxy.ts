import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Round-46 — global lockout for banned users (Next 16 proxy convention).
 *
 * The proxy decodes the session JWT (which has the role + sub baked in
 * for fast checks). Prisma is NOT available here — the edge runtime
 * doesn't have the client. So we mark the cookie at login time when we
 * KNOW the user isn't banned, and re-mark it on /api/auth/refresh. The
 * proxy then trusts the cookie's `b` claim: if true, route through /banned.
 *
 * Routes we never rewrite:
 *   - /api/* (server endpoints handle auth on their own; GraphQL context
 *     already treats banned users as anonymous and refuses every op).
 *   - /banned (the destination for banned users)
 *   - /_next/* (Next assets) and other static files
 *   - /sign-in / /sign-up / / (let unauthenticated traffic flow)
 */
const PUBLIC_PREFIXES = [
  "/api",
  "/banned",
  "/_next",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/favicon.ico",
  "/uploads",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function parseSessionCookie(
  cookieHeader: string | null,
): { sub: string; banned: boolean } | null {
  if (!cookieHeader) return null;
  let token: string | null = null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "pooldn_session") {
      token = rest.join("=");
      break;
    }
  }
  if (!token) return null;
  // JWT shape: header.payload.signature — we only peek at payload here.
  const seg = token.split(".")[1];
  if (!seg) return null;
  try {
    const json = JSON.parse(
      Buffer.from(seg.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    ) as { sub?: string; b?: boolean };
    if (typeof json.sub !== "string") return null;
    return { sub: json.sub, banned: json.b === true };
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const session = parseSessionCookie(req.headers.get("cookie"));
  if (session?.banned) {
    const url = req.nextUrl.clone();
    url.pathname = "/banned";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
