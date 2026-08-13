import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { AuthPayload } from "../types/user";
import {
  peekEmailToken,
  consumeEmailToken,
  issueEmailToken,
} from "@/lib/services/email-token.service";
import { signSessionToken, signRefreshToken, sessionCookie, refreshCookie } from "@/lib/auth/jwt";

/**
 * Round-75 — claim a "shell" (imported placeholder) profile.
 *
 * The claim link `/claim/<token>` carries a CLAIM_PROFILE EmailToken. The
 * preview query renders "Is this you?" from the shell's public data; the mutation
 * upgrades the SAME User row in place (id preserved → all history/stats carry
 * over), setting a real email + password and flipping isShell → false.
 */

const BCRYPT_ROUNDS = 10;

type ClaimPreviewShape = {
  name: string;
  username: string;
  avatarUrl: string | null;
  teams: string[];
  competitions: string[];
  matchesPlayed: number;
  framesPlayed: number;
  framesWon: number;
};

const ClaimPreview = builder
  .objectRef<ClaimPreviewShape>("ClaimPreview")
  .implement({
    description:
      "Public preview of a shell profile behind a claim link — the 'Is this you?' summary.",
    fields: (t) => ({
      name: t.exposeString("name"),
      username: t.exposeString("username"),
      avatarUrl: t.exposeString("avatarUrl", { nullable: true }),
      teams: t.exposeStringList("teams"),
      competitions: t.exposeStringList("competitions"),
      matchesPlayed: t.exposeInt("matchesPlayed"),
      framesPlayed: t.exposeInt("framesPlayed"),
      framesWon: t.exposeInt("framesWon"),
    }),
  });

const ClaimProfileInput = builder.inputType("ClaimProfileInput", {
  fields: (t) => ({
    token: t.string({ required: true }),
    email: t.string({ required: true }),
    password: t.string({ required: true }),
  }),
});

async function loadShellByToken(
  prisma: import("@/lib/generated/prisma/client").PrismaClient,
  token: string,
) {
  const peek = await peekEmailToken(prisma, token, "CLAIM_PROFILE");
  if (!peek) return null;
  const user = await prisma.user.findUnique({ where: { id: peek.userId } });
  if (!user || !user.isShell) return null;
  return user;
}

builder.queryFields((t) => ({
  claimPreview: t.field({
    type: ClaimPreview,
    nullable: true,
    description:
      "Preview the shell profile a claim token points at. Null if the token is invalid, expired, used, or already claimed.",
    args: { token: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const user = await loadShellByToken(ctx.prisma, args.token);
      if (!user) return null;
      const [memberships, rosters, stats] = await Promise.all([
        ctx.prisma.teamMember.findMany({
          where: { userId: user.id },
          select: { team: { select: { name: true } } },
        }),
        ctx.prisma.competitionRoster.findMany({
          where: { userId: user.id },
          select: { competition: { select: { name: true } } },
        }),
        ctx.prisma.playerCompStat.findMany({
          where: { userId: user.id },
          select: { matchesPlayed: true, framesPlayed: true, framesWon: true },
        }),
      ]);
      return {
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl ?? null,
        teams: Array.from(new Set(memberships.map((m) => m.team.name))),
        competitions: Array.from(
          new Set(rosters.map((r) => r.competition.name)),
        ),
        matchesPlayed: stats.reduce((a, s) => a + s.matchesPlayed, 0),
        framesPlayed: stats.reduce((a, s) => a + s.framesPlayed, 0),
        framesWon: stats.reduce((a, s) => a + s.framesWon, 0),
      };
    },
  }),
}));

builder.mutationFields((t) => ({
  claimProfile: t.field({
    type: AuthPayload,
    description:
      "Claim a shell profile with an email + password. Upgrades the shell in place (same id) and starts a session. Blocks if the email already belongs to a real account.",
    args: { input: t.arg({ type: ClaimProfileInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      const shell = await loadShellByToken(ctx.prisma, args.input.token);
      if (!shell) {
        throw new GraphQLError(
          "This claim link is invalid, expired, or already used.",
          { extensions: { code: "NOT_FOUND" } },
        );
      }
      const email = args.input.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new GraphQLError("Enter a valid email address.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (args.input.password.length < 8) {
        throw new GraphQLError("Password must be at least 8 characters.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      // Round-75 — v1 does NOT merge. If this email already belongs to a real
      // (non-shell) account, stop and route them to the organizer.
      const clash = await ctx.prisma.user.findFirst({
        where: { email, isShell: false, id: { not: shell.id } },
        select: { id: true },
      });
      if (clash) {
        throw new GraphQLError(
          "That email is already tied to an account. Contact the league organizer to link your history.",
          { extensions: { code: "EMAIL_IN_USE" } },
        );
      }

      const password = await bcrypt.hash(args.input.password, BCRYPT_ROUNDS);
      // Upgrade the shell row IN PLACE — id is preserved, so every match,
      // roster spot, standing and MVP row it owns becomes this real account's.
      const user = await ctx.prisma.user.update({
        where: { id: shell.id },
        data: {
          email,
          password,
          isShell: false,
          isActive: true,
          emailVerified: false,
          claimedAt: new Date(),
        },
      });
      // Single-use: burn the claim token so the link can't be replayed.
      await consumeEmailToken(ctx.prisma, args.input.token, "CLAIM_PROFILE");

      // Fire a verification email (best-effort — don't fail the claim on it).
      try {
        const { token: verifyToken } = await issueEmailToken(ctx.prisma, {
          userId: user.id,
          purpose: "VERIFY_EMAIL",
          ttlMs: 24 * 60 * 60 * 1000,
        });
        const { sendEmailVerification } = await import(
          "@/lib/services/email.service"
        );
        await sendEmailVerification({
          to: user.email,
          name: user.name ?? "there",
          token: verifyToken,
        });
      } catch {
        // ignore — the user can resend from Settings → Account.
      }

      const token = await signSessionToken({
        userId: user.id,
        username: user.username,
        role: user.role,
      });
      const refreshToken = await signRefreshToken({ userId: user.id });
      ctx.responseHeaders.append("set-cookie", sessionCookie(token));
      ctx.responseHeaders.append("set-cookie", refreshCookie(refreshToken));
      return { token, user: { id: user.id } };
    },
  }),
}));
