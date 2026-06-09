import crypto from "node:crypto";
import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { LoginInput, RegisterInput, AuthPayload } from "../types/user";
import { loginUser, registerUser } from "@/lib/services/auth.service";
import {
  clearRefreshCookie,
  clearSessionCookie,
  refreshCookie,
  sessionCookie,
} from "@/lib/auth/jwt";
import { logSecurityEvent } from "@/lib/security/audit";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeAll, describeWait } from "@/lib/security/rate-limit";

/**
 * Round-47 — rate-limit rules for the auth surface. Tightest scopes first.
 * We compose multiple keys on each call so a single IP can't grind a
 * mailing list and a single email can't be hammered from a botnet.
 */
const LOGIN_RULE = { name: "login", limit: 10, windowMs: 5 * 60_000 } as const;
const LOGIN_IP_RULE = { name: "login-ip", limit: 30, windowMs: 60 * 60_000 } as const;
const REGISTER_RULE = { name: "register", limit: 8, windowMs: 60 * 60_000 } as const;
const RESET_REQUEST_RULE = {
  name: "reset-request",
  limit: 5,
  windowMs: 60 * 60_000,
} as const;

function hash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function rateLimited(resetAt: number): never {
  const { retryAfterSec, pretty } = describeWait(resetAt);
  throw new GraphQLError(
    `Too many attempts — try again in ${pretty}.`,
    { extensions: { code: "RATE_LIMITED", retryAfterSec } },
  );
}

builder.mutationFields((t) => ({
  register: t.field({
    type: AuthPayload,
    description: "Create a PLAYER account and start a session.",
    args: { input: t.arg({ type: RegisterInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      const ip = getClientIp(ctx.request);
      const rl = await consumeAll(REGISTER_RULE, [
        `ip:${ip}`,
        `email:${hash(args.input.email.toLowerCase().trim())}`,
      ]);
      if (!rl.ok) {
        logSecurityEvent(ctx.prisma, ctx.request, {
          kind: "RATE_LIMITED",
          identifier: args.input.email,
          note: "register",
        });
        rateLimited(rl.resetAt);
      }
      const { user, token, refreshToken } = await registerUser(
        ctx.prisma,
        args.input,
      );
      // Round-44 — set BOTH the short-lived access token and the long-lived
      // refresh token as HttpOnly cookies. The legacy `token` field in the
      // AuthPayload response stays so non-browser clients (mobile, CLI) keep
      // working via the Authorization header path.
      ctx.responseHeaders.append("set-cookie", sessionCookie(token));
      ctx.responseHeaders.append("set-cookie", refreshCookie(refreshToken));
      logSecurityEvent(ctx.prisma, ctx.request, {
        kind: "REGISTER",
        userId: user.id,
        identifier: user.email,
      });
      return { token, user: { id: user.id } };
    },
  }),

  login: t.field({
    type: AuthPayload,
    description: "Authenticate by username or email + password.",
    args: { input: t.arg({ type: LoginInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      const ip = getClientIp(ctx.request);
      const idHash = hash(args.input.usernameOrEmail.toLowerCase().trim());
      // Two-rule check: hour-long IP cap (catches credential-stuffing
      // sweeps) + 5-minute (ip + identifier) cap (catches password
      // spraying against a single account).
      const rl = await consumeAll(LOGIN_RULE, [
        `ip:${ip}:id:${idHash}`,
      ]);
      const rlIp = await consumeAll(LOGIN_IP_RULE, [`ip:${ip}`]);
      if (!rl.ok || !rlIp.ok) {
        logSecurityEvent(ctx.prisma, ctx.request, {
          kind: "RATE_LIMITED",
          identifier: args.input.usernameOrEmail,
          note: "login",
        });
        rateLimited(rl.ok ? rlIp.resetAt : rl.resetAt);
      }
      try {
        const { user, token, refreshToken } = await loginUser(
          ctx.prisma,
          args.input,
        );
        ctx.responseHeaders.append("set-cookie", sessionCookie(token));
        ctx.responseHeaders.append("set-cookie", refreshCookie(refreshToken));
        logSecurityEvent(ctx.prisma, ctx.request, {
          kind: "LOGIN_OK",
          userId: user.id,
          identifier: args.input.usernameOrEmail,
        });
        return { token, user: { id: user.id } };
      } catch (e) {
        logSecurityEvent(ctx.prisma, ctx.request, {
          kind: "LOGIN_FAIL",
          identifier: args.input.usernameOrEmail,
          note: e instanceof Error ? e.message : "unknown",
        });
        throw e;
      }
    },
  }),

  logout: t.boolean({
    description: "Clear both the session and refresh cookies.",
    resolve: (_root, _args, ctx) => {
      ctx.responseHeaders.append("set-cookie", clearSessionCookie());
      ctx.responseHeaders.append("set-cookie", clearRefreshCookie());
      return true;
    },
  }),
}));

// Export rules for the password-reset resolver to reuse without circular
// imports — single source of truth for limits lives here.
export { RESET_REQUEST_RULE };
