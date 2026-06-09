/**
 * Round-47 — issue + redeem email-driven action tokens.
 *
 * Plaintext token is only ever returned from `issueEmailToken` (and
 * embedded in the outbound email). The DB stores its sha256 hash so a DB
 * leak doesn't grant ban-list-bypass / account-takeover via the link.
 */
import crypto from "node:crypto";
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type EmailTokenPurpose = "VERIFY_EMAIL" | "PASSWORD_RESET";

const RAW_LEN = 32;

function randomToken(): string {
  return crypto.randomBytes(RAW_LEN).toString("base64url");
}

function hash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueEmailToken(
  prisma: PrismaClient,
  opts: {
    userId: string;
    purpose: EmailTokenPurpose;
    pendingEmail?: string;
    ttlMs: number;
  },
): Promise<{ token: string }> {
  const token = randomToken();
  const tokenHash = hash(token);
  const expiresAt = new Date(Date.now() + opts.ttlMs);
  await prisma.emailToken.create({
    data: {
      userId: opts.userId,
      purpose: opts.purpose,
      tokenHash,
      pendingEmail: opts.pendingEmail ?? null,
      expiresAt,
    },
  });
  return { token };
}

/**
 * Look up a token by its plaintext value, mark it consumed, and return its
 * row. Returns null if not found, expired, or already used.
 */
export async function consumeEmailToken(
  prisma: PrismaClient,
  token: string,
  purpose: EmailTokenPurpose,
): Promise<{
  userId: string;
  pendingEmail: string | null;
} | null> {
  const tokenHash = hash(token);
  return prisma.$transaction(async (tx) => {
    const row = await tx.emailToken.findUnique({ where: { tokenHash } });
    if (!row) return null;
    if (row.purpose !== purpose) return null;
    if (row.usedAt) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    await tx.emailToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return { userId: row.userId, pendingEmail: row.pendingEmail };
  });
}
