/**
 * Round-47 — canonical public origin for OAuth / redirect-URL building.
 *
 * Behind a reverse proxy (nginx, Caddy, Cloudflare Tunnel, kamal-proxy, etc.)
 * `new URL(request.url).origin` resolves to the INTERNAL upstream the proxy
 * forwarded to (e.g. `https://localhost:8084`) instead of the PUBLIC hostname
 * users actually see (`https://pooldn.thebaycity.dev`). That breaks OAuth:
 * we'd register `https://pooldn.thebaycity.dev/api/auth/facebook/callback`
 * with Facebook, but send `https://localhost:8084/api/auth/facebook/callback`
 * as `redirect_uri` — Facebook redirects faithfully and the user lands on a
 * URL only reachable from the server itself.
 *
 * Set `NEXT_PUBLIC_APP_URL` to the public origin in production env and this
 * helper will use it everywhere. In dev (or when the var isn't set) we fall
 * back to the request URL, which is correct for `next dev` on
 * `http://localhost:3000`.
 *
 * We deliberately do NOT trust `X-Forwarded-Host` / `X-Forwarded-Proto`
 * here: those headers are client-settable when the proxy doesn't strip
 * them, and trusting them on the callback path would let an attacker
 * redirect victims (with their OAuth `code`) to a domain they control.
 * An explicit env var is the safe choice.
 */
export function appOrigin(request: Request): string {
  const override = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return new URL(request.url).origin;
}
