import { GraphQLError } from "graphql";
import bcrypt from "bcryptjs";
import type { PrismaClient, User } from "@/lib/generated/prisma/client";
import { signSessionToken, signRefreshToken } from "@/lib/auth/jwt";
import { defaultUserLocation } from "@/lib/services/user.service";

const BCRYPT_ROUNDS = 10;

/**
 * Round-45 — auto-generate username from name+email when the client doesn't
 * supply one (or supplies an already-taken one).
 *
 * Strategy: derive a clean base (`john.smith`, `jane.t`), check the DB;
 * if it clashes, append a 2-digit numeric suffix and retry until we find a
 * free slot. Cap at 50 tries to be safe (collision probability is tiny).
 */
async function pickAvailableUsername(
  prisma: PrismaClient,
  candidate: string,
): Promise<string> {
  const base = sanitize(candidate) || "player";
  // Truncate to 22 chars to leave room for a 2-digit suffix.
  const head = base.slice(0, 22);
  for (let i = 0; i < 50; i++) {
    const tryName = i === 0 ? head : `${head}${i + 1}`;
    const taken = await prisma.user.findUnique({
      where: { username: tryName },
      select: { id: true },
    });
    if (!taken) return tryName;
  }
  // Extreme fallback — random suffix; collision odds in (2^48) are nil.
  return `${head}${Math.random().toString(36).slice(2, 8)}`;
}

function sanitize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

export async function registerUser(
  prisma: PrismaClient,
  input: {
    name: string;
    /** Optional. If omitted or already taken, the server picks one. */
    username?: string | null;
    email: string;
    password: string;
  },
): Promise<{ user: User; token: string; refreshToken: string }> {
  const email = input.email.toLowerCase().trim();

  // Email is hard-unique — fail fast if already used.
  const emailClash = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (emailClash) {
    throw new GraphQLError("Email already registered", {
      extensions: { code: "EMAIL_TAKEN" },
    });
  }

  // Choose the username — caller hint first, else fall back to the name's
  // first token, else the email's local part. Then resolve collisions by
  // appending an incrementing suffix.
  const hint =
    (input.username && sanitize(input.username)) ||
    sanitize(input.name.split(/\s+/)[0] ?? "") ||
    sanitize(email.split("@")[0] ?? "");
  const username = await pickAvailableUsername(prisma, hint);

  const password = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      username,
      email,
      password,
      role: "PLAYER",
      ...(await defaultUserLocation(prisma)),
    },
  });
  const token = await signSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });
  const refreshToken = await signRefreshToken({ userId: user.id });
  return { user, token, refreshToken };
}

export async function loginUser(
  prisma: PrismaClient,
  input: { usernameOrEmail: string; password: string },
): Promise<{ user: User; token: string; refreshToken: string }> {
  const candidate = input.usernameOrEmail.toLowerCase().trim();
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: candidate }, { email: candidate }] },
  });
  // Same generic wording for both "no such account" and "wrong password" so
  // we don't leak which emails exist on the platform. The login form surfaces
  // this string verbatim — keep it natural-language.
  const INVALID = "Email or password does not match. Try again.";
  // Round-75 — shell (unclaimed placeholder) accounts are isActive:false, so
  // the guard below already blocks them; the explicit isShell check is
  // defense-in-depth and future-proofs against isActive semantics changing.
  if (!user || !user.isActive || user.isShell) {
    throw new GraphQLError(INVALID, {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
  const ok = await bcrypt.compare(input.password, user.password);
  if (!ok) {
    throw new GraphQLError(INVALID, {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
  // Round-46 — banned users can't get a new session token. Return a
  // dedicated error code so the UI can route to a "you are banned" screen
  // instead of silently failing with "invalid credentials".
  if (user.bannedAt) {
    throw new GraphQLError(
      user.banReason
        ? `Account banned: ${user.banReason}`
        : "Your account has been banned. Contact support.",
      { extensions: { code: "BANNED" } },
    );
  }
  const token = await signSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });
  const refreshToken = await signRefreshToken({ userId: user.id });
  return { user, token, refreshToken };
}
