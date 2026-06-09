import type { YogaInitialContext } from "graphql-yoga";
import { prisma } from "@/lib/prisma";
import type { PrismaClient, User } from "@/lib/generated/prisma/client";
import {
  readSessionCookie,
  verifySessionToken,
} from "@/lib/auth/jwt";
import { defineAbilityFor, type AppAbility } from "@/lib/casl/ability";

export type ServerContext = {
  responseHeaders: Headers;
};

export type GraphQLContext = {
  prisma: PrismaClient;
  request: Request;
  responseHeaders: Headers;
  viewer: User | null;
  ability: AppAbility;
};

export async function createContext(
  initial: YogaInitialContext & ServerContext,
): Promise<GraphQLContext> {
  // Round-44 — cookie is the default for browser sessions; Authorization
  // header is an optional fallback for non-browser callers (mobile, CLI,
  // server-to-server). Cookie wins if both are present so SSR + browser
  // share a single source of truth.
  const cookieHeader = initial.request.headers.get("cookie");
  const cookieToken = readSessionCookie(cookieHeader);
  const authz = initial.request.headers.get("authorization");
  const bearer = authz?.toLowerCase().startsWith("bearer ")
    ? authz.slice(7).trim()
    : null;
  const token = cookieToken ?? bearer;

  let viewer: User | null = null;
  if (token) {
    const claims = await verifySessionToken(token);
    if (claims?.sub) {
      viewer = await prisma.user.findUnique({ where: { id: claims.sub } });
    }
  }

  // Round-46 — banned users are treated as anonymous at the API boundary:
  // they can't read anything (CASL falls through to the guest baseline) and
  // they can't call any authenticated mutation (the guards throw FORBIDDEN).
  // The Next middleware separately redirects every page to /banned so the
  // browser experience matches the API one.
  if (viewer && viewer.bannedAt) {
    viewer = null;
  }

  const ability = defineAbilityFor(
    viewer ? { id: viewer.id, role: viewer.role } : null,
  );

  return {
    prisma,
    request: initial.request,
    responseHeaders: initial.responseHeaders,
    viewer,
    ability,
  };
}
