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
  const cookieHeader = initial.request.headers.get("cookie");
  const authz = initial.request.headers.get("authorization");
  const bearer = authz?.toLowerCase().startsWith("bearer ")
    ? authz.slice(7).trim()
    : null;
  const token = bearer ?? readSessionCookie(cookieHeader);

  let viewer: User | null = null;
  if (token) {
    const claims = await verifySessionToken(token);
    if (claims?.sub) {
      viewer = await prisma.user.findUnique({ where: { id: claims.sub } });
    }
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
