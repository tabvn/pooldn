import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  signSessionToken,
  signRefreshToken,
  sessionCookie,
  refreshCookie,
} from "@/lib/auth/jwt";
import {
  exchangeCode,
  googleConfigured,
  redirectUriFor,
  verifyIdToken,
  type GoogleIdentity,
} from "@/lib/auth/google";

export const runtime = "nodejs";

function fail(origin: string, code: string) {
  return NextResponse.redirect(new URL(`/sign-in?authError=${code}`, origin));
}

/**
 * Round-47 — clear the temp PKCE/state cookies via raw Set-Cookie headers
 * (NOT res.cookies.set). The success path issues session cookies via
 * res.headers.append; mixing the two APIs on the same response causes
 * NextResponse to serialize through its cookies store and drop the
 * appended headers — symptom: Google login redirects but no
 * pooldn_session cookie lands, so /onboarding bounces back to /sign-in.
 * Sticking to headers.append for every cookie keeps the chain intact.
 */
function clearTemp(res: NextResponse) {
  for (const n of ["g_state", "g_nonce", "g_verifier", "g_next"]) {
    res.headers.append(
      "Set-Cookie",
      `${n}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );
  }
}

function sanitizeUsername(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 22);
}

async function pickUsername(base: string): Promise<string> {
  const head = sanitizeUsername(base) || "player";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? head : `${head}${i + 1}`;
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${head}${crypto.randomBytes(3).toString("hex")}`;
}

/**
 * Resolve the app user for a verified Google identity.
 *  - Email already in the system → log in as THAT account (backfill avatar /
 *    emailVerified from Google, never downgrading existing data). `isNew=false`.
 *  - Otherwise create a new PLAYER pre-filled from Google (name + avatar),
 *    email pre-verified. `isNew=true` so the caller can route them to
 *    onboarding to review/complete their profile.
 */
async function resolveUser(
  id: GoogleIdentity,
): Promise<{ user: Awaited<ReturnType<typeof prisma.user.create>>; isNew: boolean }> {
  const existing = await prisma.user.findUnique({ where: { email: id.email } });
  if (existing) {
    const data: Record<string, unknown> = {};
    if (!existing.emailVerified) data.emailVerified = true;
    if (!existing.avatarUrl && id.picture) data.avatarUrl = id.picture;
    const user = Object.keys(data).length
      ? await prisma.user.update({ where: { id: existing.id }, data })
      : existing;
    return { user, isNew: false };
  }
  const username = await pickUsername(id.name || id.email.split("@")[0]);
  // OAuth accounts have no real password; store a random bcrypt hash so the
  // (currently non-null) column is satisfied. Password login won't match it.
  const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  const user = await prisma.user.create({
    data: {
      name: id.name,
      username,
      email: id.email,
      password: randomPassword,
      avatarUrl: id.picture ?? undefined,
      emailVerified: true,
      role: "PLAYER",
    },
  });
  return { user, isNew: true };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  if (!googleConfigured()) return fail(origin, "google_unconfigured");

  const err = url.searchParams.get("error");
  if (err) return fail(origin, "google_denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Read the temp cookies set by /start.
  const jar = request.headers.get("cookie") ?? "";
  const readCookie = (n: string) =>
    jar.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${n}=`))?.split("=").slice(1).join("=") ?? "";
  const cookieState = readCookie("g_state");
  const nonce = readCookie("g_nonce");
  const verifier = readCookie("g_verifier");
  const next = decodeURIComponent(readCookie("g_next") || "/") || "/";

  if (!code || !state || !cookieState || state !== cookieState || !verifier || !nonce) {
    const res = fail(origin, "google_state");
    clearTemp(res);
    return res;
  }

  try {
    const { idToken } = await exchangeCode({
      code,
      redirectUri: redirectUriFor(origin),
      codeVerifier: verifier,
    });
    const identity = await verifyIdToken(idToken, nonce);
    if (!identity.emailVerified) {
      const res = fail(origin, "google_email_unverified");
      clearTemp(res);
      return res;
    }

    const { user, isNew } = await resolveUser(identity);
    if (!user.isActive) {
      const res = fail(origin, "account_suspended");
      clearTemp(res);
      return res;
    }

    const token = await signSessionToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });
    const refresh = await signRefreshToken({ userId: user.id });

    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    // New accounts review/complete their Google-filled profile first;
    // returning users go straight where they were headed.
    const dest = isNew ? "/onboarding" : safeNext;
    const res = NextResponse.redirect(new URL(dest, origin));
    res.headers.append("Set-Cookie", sessionCookie(token));
    res.headers.append("Set-Cookie", refreshCookie(refresh));
    clearTemp(res);
    return res;
  } catch (e) {
    console.error("[google callback]", e);
    const res = fail(origin, "google_failed");
    clearTemp(res);
    return res;
  }
}
