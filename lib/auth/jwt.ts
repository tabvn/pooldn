import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-change-me",
);
const REFRESH_SECRET = new TextEncoder().encode(
  process.env.AUTH_REFRESH_SECRET ?? process.env.AUTH_SECRET ?? "dev-refresh-secret-change-me",
);
const ALG = "HS256";
const COOKIE_NAME = "pooldn_session";
const REFRESH_COOKIE_NAME = "pooldn_refresh";

// Round-44 — short-lived access token + long-lived refresh.
// Refresh token rotates the access token via /api/auth/refresh; revoking the
// refresh cookie ends the session even if an old access token is still valid.
const ACCESS_TTL_SECONDS = 60 * 15; // 15 minutes
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionClaims = JWTPayload & {
  sub: string;
  username: string;
  role: string;
};

export type RefreshClaims = JWTPayload & {
  sub: string;
  // Identifies the refresh "family" so a rotation can be tracked / revoked
  // server-side later if desired.
  fam: string;
};

export async function signSessionToken(claims: {
  userId: string;
  username: string;
  role: string;
  banned?: boolean;
}): Promise<string> {
  return new SignJWT({
    username: claims.username,
    role: claims.role,
    // Round-46 — the middleware peeks at this `b` claim to short-circuit
    // banned users without a DB round-trip. Login never sets `b: true`
    // (banned users can't log in); /api/auth/refresh sets it when the
    // DB now shows them banned, forcing the redirect on the next page load.
    b: claims.banned ?? false,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function signRefreshToken(claims: {
  userId: string;
  fam?: string;
}): Promise<string> {
  return new SignJWT({
    fam: claims.fam ?? cryptoRandomId(),
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL_SECONDS}s`)
    .sign(REFRESH_SECRET);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify<SessionClaims>(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshClaims | null> {
  try {
    const { payload } = await jwtVerify<RefreshClaims>(token, REFRESH_SECRET);
    return payload;
  } catch {
    return null;
  }
}

function buildCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
): string {
  return [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function sessionCookie(token: string): string {
  return buildCookie(COOKIE_NAME, token, ACCESS_TTL_SECONDS);
}

export function refreshCookie(token: string): string {
  return buildCookie(REFRESH_COOKIE_NAME, token, REFRESH_TTL_SECONDS);
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function clearRefreshCookie(): string {
  return `${REFRESH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readCookie(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

export function readSessionCookie(cookieHeader: string | null): string | null {
  return readCookie(cookieHeader, COOKIE_NAME);
}

export function readRefreshCookie(cookieHeader: string | null): string | null {
  return readCookie(cookieHeader, REFRESH_COOKIE_NAME);
}

function cryptoRandomId(): string {
  // 16 hex bytes is sufficient for a family identifier; collision-resistant
  // and short. Crypto is dynamically imported because this module is loaded
  // in both edge and node contexts.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  return randomBytes(16).toString("hex");
}

export {
  COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
};
