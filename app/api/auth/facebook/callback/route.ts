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
  facebookConfigured,
  fetchProfile,
  redirectUriFor,
  type FacebookIdentity,
} from "@/lib/auth/facebook";

export const runtime = "nodejs";

function fail(origin: string, code: string) {
  return NextResponse.redirect(new URL(`/sign-in?authError=${code}`, origin));
}

function clearTemp(res: NextResponse) {
  for (const n of ["fb_state", "fb_next"]) {
    res.cookies.set(n, "", { path: "/", maxAge: 0 });
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

/** Same policy as Google: match verified email → login; else create → onboarding. */
async function resolveUser(
  id: FacebookIdentity & { email: string },
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

  if (!facebookConfigured()) return fail(origin, "facebook_unconfigured");

  const err = url.searchParams.get("error");
  if (err) return fail(origin, "facebook_denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = request.headers.get("cookie") ?? "";
  const readCookie = (n: string) =>
    jar.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${n}=`))?.split("=").slice(1).join("=") ?? "";
  const cookieState = readCookie("fb_state");
  const next = decodeURIComponent(readCookie("fb_next") || "/") || "/";

  if (!code || !state || !cookieState || state !== cookieState) {
    const res = fail(origin, "facebook_state");
    clearTemp(res);
    return res;
  }

  try {
    const { accessToken } = await exchangeCode({
      code,
      redirectUri: redirectUriFor(origin),
    });
    const identity = await fetchProfile(accessToken);

    // Facebook may not share an email (no permission, or none on file). We
    // can't safely match/create an account without it in this v1 (no provider
    // table keyed by FB id). Ask the user to use another method / grant email.
    if (!identity.email) {
      const res = fail(origin, "facebook_no_email");
      clearTemp(res);
      return res;
    }

    const { user, isNew } = await resolveUser({ ...identity, email: identity.email });
    // Remember the Facebook id so the Data Deletion callback can find this
    // user later. Raw SQL → compiles before the `facebookId` migration lands;
    // best-effort so login never fails if the column isn't there yet.
    try {
      await prisma.$executeRawUnsafe(
        'UPDATE "users" SET "facebookId" = $1 WHERE id = $2',
        identity.id,
        user.id,
      );
    } catch {
      /* column not migrated yet — non-fatal */
    }
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
    const dest = isNew ? "/onboarding" : safeNext;
    const res = NextResponse.redirect(new URL(dest, origin));
    res.headers.append("Set-Cookie", sessionCookie(token));
    res.headers.append("Set-Cookie", refreshCookie(refresh));
    clearTemp(res);
    return res;
  } catch (e) {
    console.error("[facebook callback]", e);
    const res = fail(origin, "facebook_failed");
    clearTemp(res);
    return res;
  }
}
