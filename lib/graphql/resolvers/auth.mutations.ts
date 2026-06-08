import { builder } from "../builder";
import { LoginInput, RegisterInput, AuthPayload } from "../types/user";
import { loginUser, registerUser } from "@/lib/services/auth.service";
import { clearSessionCookie, sessionCookie } from "@/lib/auth/jwt";

builder.mutationFields((t) => ({
  register: t.field({
    type: AuthPayload,
    description: "Create a PLAYER account and start a session.",
    args: { input: t.arg({ type: RegisterInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      const { user, token } = await registerUser(ctx.prisma, args.input);
      ctx.responseHeaders.append("set-cookie", sessionCookie(token));
      return { token, user: { id: user.id } };
    },
  }),

  login: t.field({
    type: AuthPayload,
    description: "Authenticate by username or email + password.",
    args: { input: t.arg({ type: LoginInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      const { user, token } = await loginUser(ctx.prisma, args.input);
      ctx.responseHeaders.append("set-cookie", sessionCookie(token));
      return { token, user: { id: user.id } };
    },
  }),

  logout: t.boolean({
    description: "Clear the session cookie.",
    resolve: (_root, _args, ctx) => {
      ctx.responseHeaders.append("set-cookie", clearSessionCookie());
      return true;
    },
  }),
}));
