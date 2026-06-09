import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  readRefreshCookie,
  refreshCookie,
  sessionCookie,
  signRefreshToken,
  signSessionToken,
  verifyRefreshToken,
} from "@/lib/auth/jwt";

/**
 * POST /api/auth/refresh — rotates the access + refresh cookies.
 *
 * Client behavior: when an Apollo request gets UNAUTHORIZED (the access
 * token expired), the Apollo link catches it, calls this endpoint to mint a
 * fresh pair, and retries the original operation. No body required; the
 * refresh token lives in an HttpOnly cookie so JS can't read it.
 *
 * Refresh token rotation: every refresh issues a NEW family id, invalidating
 * the previous token. (Server-side revocation list can hook here later.)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const token = readRefreshCookie(cookieHeader);
  if (!token) {
    return NextResponse.json(
      { error: "No refresh token" },
      { status: 401 },
    );
  }
  const claims = await verifyRefreshToken(token);
  if (!claims?.sub) {
    return NextResponse.json(
      { error: "Refresh token invalid or expired" },
      { status: 401 },
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      bannedAt: true,
    },
  });
  if (!user || !user.isActive) {
    return NextResponse.json(
      { error: "User not found or deactivated" },
      { status: 401 },
    );
  }

  // Round-46 — re-stamp the `b` claim on every refresh. A user banned after
  // their last successful login bounces to /banned on the next page load.
  const newAccess = await signSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    banned: !!user.bannedAt,
  });
  // Round-44 — rotate the refresh family id so a leaked old token can't be
  // re-used. (When server-side revocation lands we'll persist the family id.)
  const newRefresh = await signRefreshToken({ userId: user.id });

  const res = NextResponse.json({ ok: true });
  res.headers.append("set-cookie", sessionCookie(newAccess));
  res.headers.append("set-cookie", refreshCookie(newRefresh));
  return res;
}
