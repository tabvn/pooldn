import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { requireUser } from "@/lib/casl/guard";

const SECURITY_KINDS = [
  "LOGIN_OK",
  "LOGIN_FAIL",
  "REGISTER",
  "PASSWORD_RESET_REQUEST",
  "PASSWORD_RESET_REDEEM",
  "RATE_LIMITED",
] as const;

builder.queryFields((t) => ({
  securityEvents: t.prismaField({
    type: ["SecurityEvent"],
    description:
      "Round-47 — admin-only paginated view of recent auth + rate-limit events. Cursor-paginated by id; default 50 rows.",
    args: {
      kind: t.arg.string(),
      first: t.arg.int(),
      after: t.arg.id(),
    },
    resolve: (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      if (ctx.viewer.role !== "SUPER_ADMIN") {
        throw new GraphQLError("Admins only", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      const take = Math.min(Math.max(args.first ?? 50, 1), 200);
      // Validate kind to avoid arbitrary string searches (the column is
      // an indexed string but we want a stable enumeration in the UI).
      const kind =
        args.kind && (SECURITY_KINDS as readonly string[]).includes(args.kind)
          ? args.kind
          : null;
      return ctx.prisma.securityEvent.findMany({
        ...query,
        where: kind ? { kind } : undefined,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
        ...(args.after
          ? { skip: 1, cursor: { id: String(args.after) } }
          : {}),
      });
    },
  }),
}));
