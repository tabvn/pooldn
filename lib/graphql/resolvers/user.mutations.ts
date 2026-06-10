import { GraphQLError } from "graphql";
import bcrypt from "bcryptjs";
import { builder } from "../builder";
import { CreateUserInput, UpdateProfileInput } from "../types/user";
import { createUser } from "@/lib/services/user.service";
import { requireUser } from "@/lib/casl/guard";

const BCRYPT_ROUNDS = 10;

// Round-50 — keep username validation in one place so the mutation, the
// live-availability check, and (eventually) the sign-up flow agree.
//
// Rules:
//  - 3–24 characters
//  - lowercase letters, digits, underscore, dash, dot
//  - can't start or end with a separator
//  - no two consecutive separators
//  - reserved words rejected (admin paths, common system slugs)
const USERNAME_REGEX = /^[a-z0-9](?!.*[._-]{2})[a-z0-9._-]{1,22}[a-z0-9]$/;
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "support",
  "system",
  "api",
  "settings",
  "signin",
  "sign-in",
  "signup",
  "sign-up",
  "login",
  "logout",
  "auth",
  "me",
  "self",
  "null",
  "undefined",
  "pooldn",
  "anonymous",
  "guest",
]);

function validateUsernameSyntax(value: string): string | null {
  if (!value) return "Username is required";
  if (value.length < 3) return "Use at least 3 characters";
  if (value.length > 24) return "Keep it to 24 characters or fewer";
  if (!USERNAME_REGEX.test(value)) {
    return "Use lowercase letters, digits, and . _ - (no leading/trailing or doubled separators)";
  }
  if (RESERVED_USERNAMES.has(value)) {
    return "That username is reserved — try another";
  }
  return null;
}

builder.mutationFields((t) => ({
  createUser: t.prismaField({
    type: "User",
    description: "Create a new user. Password is hashed with bcrypt.",
    args: {
      input: t.arg({ type: CreateUserInput, required: true }),
    },
    resolve: (query, _root, args, ctx) =>
      createUser(
        ctx.prisma,
        {
          name: args.input.name,
          username: args.input.username,
          email: args.input.email,
          password: args.input.password,
        },
        query.select,
      ),
  }),

  updateProfile: t.prismaField({
    type: "User",
    description: "Update the current viewer's own profile.",
    args: {
      input: t.arg({ type: UpdateProfileInput, required: true }),
    },
    resolve: (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      return ctx.prisma.user.update({
        ...query,
        where: { id: ctx.viewer.id },
        data: {
          name: args.input.name ?? undefined,
          bio: args.input.bio ?? undefined,
          nationality: args.input.nationality ?? undefined,
          phone: args.input.phone ?? undefined,
          avatarUrl: args.input.avatarUrl ?? undefined,
          cityId: args.input.cityId
            ? String(args.input.cityId)
            : args.input.cityId === null
              ? null
              : undefined,
        },
      });
    },
  }),

  changePassword: t.boolean({
    description:
      "Change the viewer's own password. Requires the current password as a credential check.",
    args: {
      currentPassword: t.arg.string({ required: true }),
      newPassword: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const current = String(args.currentPassword);
      const next = String(args.newPassword);
      if (next.length < 8) {
        throw new GraphQLError("New password must be at least 8 characters", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (next === current) {
        throw new GraphQLError("New password must differ from the current one", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.viewer.id },
        select: { password: true },
      });
      const ok = await bcrypt.compare(current, user.password);
      if (!ok) {
        throw new GraphQLError("Current password is incorrect", {
          extensions: { code: "INVALID_CREDENTIALS" },
        });
      }
      const hashed = await bcrypt.hash(next, BCRYPT_ROUNDS);
      await ctx.prisma.user.update({
        where: { id: ctx.viewer.id },
        data: { password: hashed },
      });
      return true;
    },
  }),

  changeUsername: t.prismaField({
    type: "User",
    description:
      "Change the viewer's own username. 3–24 chars, lowercase letters, " +
      "digits, underscore, dash, dot; can't start/end with a separator, no " +
      "double separators, reserved words rejected. Case-insensitive uniqueness.",
    args: {
      newUsername: t.arg.string({ required: true }),
      currentPassword: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const next = String(args.newUsername).trim().toLowerCase();
      const password = String(args.currentPassword);
      const issue = validateUsernameSyntax(next);
      if (issue) {
        throw new GraphQLError(issue, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.viewer.id },
        select: { password: true, username: true },
      });
      if (next === user.username.toLowerCase()) {
        throw new GraphQLError("That's already your username", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        throw new GraphQLError("Current password is incorrect", {
          extensions: { code: "INVALID_CREDENTIALS" },
        });
      }
      const taken = await ctx.prisma.user.findFirst({
        where: {
          username: { equals: next, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (taken && taken.id !== ctx.viewer.id) {
        throw new GraphQLError("That username is already taken", {
          extensions: { code: "USERNAME_TAKEN" },
        });
      }
      return ctx.prisma.user.update({
        ...query,
        where: { id: ctx.viewer.id },
        data: { username: next },
      });
    },
  }),

  changeEmail: t.prismaField({
    type: "User",
    description:
      "Change the viewer's own email. Requires the current password and the new address must be unique.",
    args: {
      newEmail: t.arg.string({ required: true }),
      currentPassword: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const email = String(args.newEmail).trim().toLowerCase();
      const password = String(args.currentPassword);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new GraphQLError("Enter a valid email address", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.viewer.id },
        select: { password: true, email: true },
      });
      if (email === user.email.toLowerCase()) {
        throw new GraphQLError("That's already your email", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        throw new GraphQLError("Current password is incorrect", {
          extensions: { code: "INVALID_CREDENTIALS" },
        });
      }
      // Uniqueness check before the update so the error is informative instead
      // of a raw "Unique constraint failed" message from Prisma.
      const taken = await ctx.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (taken && taken.id !== ctx.viewer.id) {
        throw new GraphQLError("That email is already in use", {
          extensions: { code: "EMAIL_TAKEN" },
        });
      }
      // Round-47 — instead of swapping the email immediately, store the
      // requested address on an EmailToken and send a confirm link to the
      // NEW address. Until the user clicks the link, their account keeps
      // the old email + a "pending change" badge.
      const updated = await ctx.prisma.user.update({
        ...query,
        where: { id: ctx.viewer.id },
        data: {},
      });
      const { issueEmailToken } = await import("@/lib/services/email-token.service");
      const { token } = await issueEmailToken(ctx.prisma, {
        userId: ctx.viewer.id,
        purpose: "VERIFY_EMAIL",
        pendingEmail: email,
        ttlMs: 24 * 60 * 60 * 1000,
      });
      const { sendEmailVerification } = await import(
        "@/lib/services/email.service"
      );
      await sendEmailVerification({
        to: email,
        name: ctx.viewer.name ?? "there",
        token,
      });
      return updated;
    },
  }),

  resendEmailVerification: t.boolean({
    description:
      "Issue a fresh verification token for the viewer's current email and send the confirm link.",
    resolve: async (_root, _args, ctx) => {
      requireUser(ctx.viewer);
      const u = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.viewer.id },
        select: { email: true, name: true },
      });
      const { issueEmailToken } = await import("@/lib/services/email-token.service");
      const { token } = await issueEmailToken(ctx.prisma, {
        userId: ctx.viewer.id,
        purpose: "VERIFY_EMAIL",
        ttlMs: 24 * 60 * 60 * 1000,
      });
      const { sendEmailVerification } = await import(
        "@/lib/services/email.service"
      );
      await sendEmailVerification({
        to: u.email,
        name: u.name ?? "there",
        token,
      });
      return true;
    },
  }),

  requestPasswordReset: t.boolean({
    description:
      "Anonymous-callable. Issue a PASSWORD_RESET token + email the link. ALWAYS returns true so the endpoint doesn't leak which emails are registered.",
    args: { email: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const email = String(args.email).trim().toLowerCase();
      // Rate-limit: 5/hr per (ip + email). Both scopes; if either is
      // tripped we fail closed. This is the right tradeoff — abusers
      // can grind one but not the other.
      const { consumeAll, describeWait } = await import(
        "@/lib/security/rate-limit"
      );
      const { getClientIp } = await import("@/lib/security/client-ip");
      const { logSecurityEvent } = await import("@/lib/security/audit");
      const { RESET_REQUEST_RULE } = await import(
        "@/lib/graphql/resolvers/auth.mutations"
      );
      const ip = getClientIp(ctx.request);
      const emailHash = (await import("node:crypto"))
        .createHash("sha256")
        .update(email)
        .digest("hex")
        .slice(0, 16);
      const rl = await consumeAll(RESET_REQUEST_RULE, [
        `ip:${ip}`,
        `email:${emailHash}`,
      ]);
      if (!rl.ok) {
        logSecurityEvent(ctx.prisma, ctx.request, {
          kind: "RATE_LIMITED",
          identifier: email,
          note: "reset-request",
        });
        const { pretty, retryAfterSec } = describeWait(rl.resetAt);
        throw new GraphQLError(
          `Too many attempts — try again in ${pretty}.`,
          { extensions: { code: "RATE_LIMITED", retryAfterSec } },
        );
      }
      logSecurityEvent(ctx.prisma, ctx.request, {
        kind: "PASSWORD_RESET_REQUEST",
        identifier: email,
      });
      // Look up — but always return true regardless. Anti-enumeration.
      const u = await ctx.prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true, isActive: true },
      });
      if (u && u.isActive) {
        const { issueEmailToken } = await import(
          "@/lib/services/email-token.service"
        );
        const { token } = await issueEmailToken(ctx.prisma, {
          userId: u.id,
          purpose: "PASSWORD_RESET",
          ttlMs: 60 * 60 * 1000,
        });
        const { sendPasswordReset } = await import(
          "@/lib/services/email.service"
        );
        // Round-45 — await so we can record delivery status, but the
        // response stays `true` regardless (anti-enumeration). The send
        // function itself never throws — failures land in the dev outbox
        // and an error-level log line for triage.
        const r = await sendPasswordReset({
          to: u.email,
          name: u.name ?? "there",
          token,
        });
        if (!r.ok) {
          logSecurityEvent(ctx.prisma, ctx.request, {
            kind: "RATE_LIMITED",
            userId: u.id,
            identifier: email,
            note: `email-delivery-failed: ${r.note ?? "unknown"}`,
          });
        }
      }
      return true;
    },
  }),

  resetPassword: t.boolean({
    description:
      "Consume a PASSWORD_RESET token and set the new password. The token is single-use and time-limited.",
    args: {
      token: t.arg.string({ required: true }),
      newPassword: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const next = String(args.newPassword);
      if (next.length < 8) {
        throw new GraphQLError("Password must be at least 8 characters", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const { consumeEmailToken } = await import(
        "@/lib/services/email-token.service"
      );
      const r = await consumeEmailToken(
        ctx.prisma,
        String(args.token),
        "PASSWORD_RESET",
      );
      if (!r) {
        throw new GraphQLError("Reset link is invalid or expired", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const hashed = await bcrypt.hash(next, BCRYPT_ROUNDS);
      await ctx.prisma.user.update({
        where: { id: r.userId },
        data: { password: hashed },
      });
      const { logSecurityEvent } = await import("@/lib/security/audit");
      logSecurityEvent(ctx.prisma, ctx.request, {
        kind: "PASSWORD_RESET_REDEEM",
        userId: r.userId,
      });
      return true;
    },
  }),

  verifyEmailToken: t.boolean({
    description:
      "Redeem a verification token from an outbound email. If the token has a pending email change, the user's email is swapped; otherwise we just flip emailVerified=true.",
    args: { token: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const { consumeEmailToken } = await import(
        "@/lib/services/email-token.service"
      );
      const r = await consumeEmailToken(
        ctx.prisma,
        String(args.token),
        "VERIFY_EMAIL",
      );
      if (!r) {
        throw new GraphQLError("Verification link is invalid or expired", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      await ctx.prisma.user.update({
        where: { id: r.userId },
        data: {
          emailVerified: true,
          ...(r.pendingEmail ? { email: r.pendingEmail } : {}),
        },
      });
      return true;
    },
  }),

  adminUpdateUser: t.prismaField({
    type: "User",
    description:
      "Round-21 — SUPER_ADMIN can edit any user (name, bio, role, nationality, isActive). Admins use this when a user can't update something themselves.",
    args: {
      id: t.arg.id({ required: true }),
      name: t.arg.string(),
      bio: t.arg.string(),
      nationality: t.arg.string(),
      role: t.arg.string(),
      isActive: t.arg.boolean(),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      if (ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Admins only", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      const allowedRoles = [
        "SUPER_ADMIN",
        "ORGANIZER",
        "TEAM_CAPTAIN",
        "PLAYER",
        "VIEWER",
      ] as const;
      if (args.role && !allowedRoles.includes(args.role as never)) {
        throw new GraphQLError("Invalid role", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return ctx.prisma.user.update({
        ...query,
        where: { id: String(args.id) },
        data: {
          name: args.name ?? undefined,
          bio: args.bio === null ? null : args.bio ?? undefined,
          nationality:
            args.nationality === null
              ? null
              : args.nationality ?? undefined,
          role: (args.role as never) ?? undefined,
          isActive: args.isActive ?? undefined,
        },
      });
    },
  }),

  deactivateAccount: t.boolean({
    description:
      "Round-23 danger zone — soft-deactivate the viewer's account. Requires current password and matching username confirmation. Sets isActive=false; the user can be reactivated by an admin.",
    args: {
      currentPassword: t.arg.string({ required: true }),
      confirmUsername: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.viewer.id },
        select: { password: true, username: true },
      });
      if (String(args.confirmUsername) !== user.username) {
        throw new GraphQLError("Confirmation doesn't match your username", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const ok = await bcrypt.compare(String(args.currentPassword), user.password);
      if (!ok) {
        throw new GraphQLError("Current password is incorrect", {
          extensions: { code: "INVALID_CREDENTIALS" },
        });
      }
      await ctx.prisma.user.update({
        where: { id: ctx.viewer.id },
        data: { isActive: false },
      });
      return true;
    },
  }),
}));

// Round-50 — companion query for the username field. Lives next to the
// mutation so the syntax validator + reserved list stay in lockstep.
builder.queryFields((t) => ({
  checkUsernameAvailable: t.boolean({
    description:
      "Live availability check for the username field. Returns true when " +
      "the username passes format rules and isn't taken (case-insensitive); " +
      "the viewer's own current username also counts as available.",
    args: { username: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const next = String(args.username).trim().toLowerCase();
      if (validateUsernameSyntax(next)) return false;
      const row = await ctx.prisma.user.findFirst({
        where: { username: { equals: next, mode: "insensitive" } },
        select: { id: true },
      });
      if (!row) return true;
      return ctx.viewer?.id === row.id;
    },
  }),
}));
