import { builder } from "../builder";
import { LoginInput, RegisterInput, AuthPayload } from "../types/user";
import { loginUser, registerUser } from "@/lib/services/auth.service";
import {
  clearRefreshCookie,
  clearSessionCookie,
  refreshCookie,
  sessionCookie,
} from "@/lib/auth/jwt";

builder.mutationFields((t) => ({
  register: t.field({
    type: AuthPayload,
    description: "Create a PLAYER account and start a session.",
    args: { input: t.arg({ type: RegisterInput, required: true }) },
    resolve: async (_root, args, ctx) => {
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
      return { token, user: { id: user.id } };
    },
  }),

  login: t.field({
    type: AuthPayload,
    description: "Authenticate by username or email + password.",
    args: { input: t.arg({ type: LoginInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      const { user, token, refreshToken } = await loginUser(
        ctx.prisma,
        args.input,
      );
      ctx.responseHeaders.append("set-cookie", sessionCookie(token));
      ctx.responseHeaders.append("set-cookie", refreshCookie(refreshToken));
      return { token, user: { id: user.id } };
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
