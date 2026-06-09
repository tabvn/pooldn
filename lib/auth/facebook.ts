/**
 * Facebook Login (OAuth 2.0) — Authorization Code flow with `state` (CSRF) and
 * `appsecret_proof` on Graph calls. No external SDK: `fetch` for the token
 * exchange + profile read.
 *
 * Notes vs Google:
 *  - Facebook is plain OAuth2 (no ID token by default for web), so we read the
 *    profile from the Graph `/me` endpoint and trust the access token (verified
 *    implicitly by a successful Graph call + appsecret_proof).
 *  - `email` is NOT guaranteed: it requires the `email` permission (App Review
 *    for public use) AND the user must actually have/share one. The caller must
 *    handle the no-email case.
 *
 * Graph version is configurable via FACEBOOK_GRAPH_VERSION (default v21.0) so
 * you can bump it as Facebook deprecates old versions.
 */

import crypto from "node:crypto";

const V = process.env.FACEBOOK_GRAPH_VERSION || "v21.0";
const AUTH_ENDPOINT = `https://www.facebook.com/${V}/dialog/oauth`;
const TOKEN_ENDPOINT = `https://graph.facebook.com/${V}/oauth/access_token`;
const ME_ENDPOINT = `https://graph.facebook.com/${V}/me`;

export const FACEBOOK_CLIENT_ID = process.env.FACEBOOK_CLIENT_ID ?? "";
const FACEBOOK_CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET ?? "";

export function facebookConfigured(): boolean {
  return Boolean(FACEBOOK_CLIENT_ID && FACEBOOK_CLIENT_SECRET);
}

export function redirectUriFor(origin: string): string {
  return `${origin}/api/auth/facebook/callback`;
}

export function randomToken(bytes = 32): string {
  return crypto
    .randomBytes(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function buildAuthUrl(opts: {
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: FACEBOOK_CLIENT_ID,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    response_type: "code",
    scope: "public_profile,email",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string }> {
  const url = `${TOKEN_ENDPOINT}?${new URLSearchParams({
    client_id: FACEBOOK_CLIENT_ID,
    client_secret: FACEBOOK_CLIENT_SECRET,
    redirect_uri: opts.redirectUri,
    code: opts.code,
  })}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Facebook token exchange failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Facebook token response missing access_token");
  return { accessToken: json.access_token };
}

export type FacebookIdentity = {
  id: string;
  email: string | null;
  name: string;
  picture: string | null;
};

/** Read the profile from Graph, secured with appsecret_proof. */
export async function fetchProfile(accessToken: string): Promise<FacebookIdentity> {
  const proof = crypto
    .createHmac("sha256", FACEBOOK_CLIENT_SECRET)
    .update(accessToken)
    .digest("hex");
  const url = `${ME_ENDPOINT}?${new URLSearchParams({
    fields: "id,name,email,picture.type(large)",
    access_token: accessToken,
    appsecret_proof: proof,
  })}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Facebook /me failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const p = (await res.json()) as {
    id: string;
    name?: string;
    email?: string;
    picture?: { data?: { url?: string; is_silhouette?: boolean } };
  };
  const pic = p.picture?.data;
  return {
    id: String(p.id),
    email: typeof p.email === "string" && p.email.trim() ? p.email.toLowerCase() : null,
    name: typeof p.name === "string" && p.name.trim() ? p.name.trim() : `Player ${p.id.slice(-4)}`,
    picture: pic && pic.url && !pic.is_silhouette ? pic.url : null,
  };
}
