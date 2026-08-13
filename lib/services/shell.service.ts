/**
 * Round-75 — "shell" (placeholder) account creation for importing an offline
 * league. A shell satisfies User's non-null/unique constraints with SYNTHETIC
 * values (a `.invalid` email, a random bcrypt password) and is flagged
 * isShell:true + isActive:false so it can't sign in, be notified, or appear as
 * a real player. A real person later takes it over via /claim/<token>, which
 * upgrades THIS row in place (same id → all derived stats/history carry over).
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient, User } from "@/lib/generated/prisma/client";
import { defaultUserLocation } from "./user.service";
import { issueEmailToken } from "./email-token.service";

const BCRYPT_ROUNDS = 10;
// Claim links are long-lived — a league organizer distributes them over days
// or weeks. 60 days; reissue a fresh token if one lapses.
const CLAIM_TTL_MS = 1000 * 60 * 60 * 24 * 60;

function slugifyUsername(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  return base || "player";
}

/** Case-insensitive-unique username derived from the player's real name. */
async function uniqueUsername(
  prisma: PrismaClient,
  hint: string,
): Promise<string> {
  const base = slugifyUsername(hint);
  let candidate = base;
  let n = 1;
  while (
    await prisma.user.findFirst({
      where: { username: { equals: candidate, mode: "insensitive" } },
      select: { id: true },
    })
  ) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

/**
 * Create one shell User + its CLAIM_PROFILE token. `nationality`/`cityId`
 * default to the league/home location; the claimer corrects them at onboarding.
 */
export async function createShellUser(
  prisma: PrismaClient,
  opts: { name: string; cityId?: string | null; nationality?: string | null },
): Promise<{ user: User; claimToken: string }> {
  const loc = await defaultUserLocation(prisma);
  const cityId = opts.cityId || loc.cityId;
  const nationality = opts.nationality || loc.nationality;
  const username = await uniqueUsername(prisma, opts.name);
  // `.invalid` is reserved (RFC 2606): never a real inbox, never collides with
  // a real signup. NEVER store a claimer's real email here — that would let the
  // OAuth-by-email path silently hand over the account (see auth callbacks).
  const email = `shell+${crypto.randomBytes(8).toString("hex")}@placeholder.pooldn.invalid`;
  const password = await bcrypt.hash(
    crypto.randomBytes(32).toString("hex"),
    BCRYPT_ROUNDS,
  );
  const user = await prisma.user.create({
    data: {
      name: opts.name.trim(),
      username,
      email,
      password,
      nationality,
      cityId,
      role: "PLAYER",
      isShell: true,
      isActive: false,
      emailVerified: false,
    },
  });
  const { token } = await issueEmailToken(prisma, {
    userId: user.id,
    purpose: "CLAIM_PROFILE",
    ttlMs: CLAIM_TTL_MS,
  });
  return { user, claimToken: token };
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "https://pooldn.thebaycity.dev";

/** Absolute claim link the organizer distributes to the real player. */
export function buildClaimUrl(token: string): string {
  return `${APP_URL}/claim/${encodeURIComponent(token)}`;
}
