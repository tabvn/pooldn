/**
 * Google Sign-In (OAuth 2.0 / OpenID Connect) — Authorization Code flow with
 * PKCE + state + nonce. No external OAuth SDK: we use `fetch` for the token
 * exchange and `jose` (already a dependency) to verify Google's ID token
 * against their JWKS.
 *
 * Whitelisted origins (Google Console): https://pooldn.thebaycity.dev,
 * http://localhost:3000. The redirect URI is derived from the incoming
 * request origin, so both work without per-env config — each origin's
 * `/api/auth/google/callback` must be registered as an Authorized redirect
 * URI in the Google OAuth client.
 */

import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

export function googleConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

/** Callback URL for this request's origin (must be registered in the console). */
export function redirectUriFor(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

// ── PKCE + random helpers ────────────────────────────────────────────────
function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function randomToken(bytes = 32): string {
  return base64url(crypto.randomBytes(bytes));
}
export function makePkce(): { verifier: string; challenge: string } {
  const verifier = randomToken(32);
  const challenge = base64url(
    crypto.createHash("sha256").update(verifier).digest(),
  );
  return { verifier, challenge };
}

/** Build the Google authorization URL to redirect the user to. */
export function buildAuthUrl(opts: {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    nonce: opts.nonce,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Exchange the authorization code for tokens (returns the raw id_token). */
export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ idToken: string }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opts.code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
      code_verifier: opts.codeVerifier,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) throw new Error("Google token response missing id_token");
  return { idToken: json.id_token };
}

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
};

/**
 * Verify the ID token signature (Google JWKS), audience, issuer, expiry, and
 * nonce. Returns the trusted identity. Throws on any failure.
 */
export async function verifyIdToken(
  idToken: string,
  expectedNonce: string,
): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: GOOGLE_CLIENT_ID,
  });
  if (payload.nonce !== expectedNonce) {
    throw new Error("Google ID token nonce mismatch");
  }
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  if (!email) throw new Error("Google ID token missing email");
  return {
    sub: String(payload.sub),
    email,
    emailVerified,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email.split("@")[0],
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}
