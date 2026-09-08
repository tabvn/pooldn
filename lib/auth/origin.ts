/**
 * Round-47 — canonical public origin for OAuth / redirect-URL building.
 * Round-76 — extended to an allowlist so the app can be served on more
 * than one public domain at once (e.g. `pooldn.thebaycity.dev` and
 * `playpoolapp.com`) without either one breaking sign-in.
 *
 * Behind a reverse proxy (nginx, Caddy, Cloudflare Tunnel, kamal-proxy, etc.)
 * `new URL(request.url).origin` resolves to the INTERNAL upstream the proxy
 * forwarded to (e.g. `https://localhost:8084`) instead of the PUBLIC hostname
 * users actually see. That breaks OAuth: we'd register
 * `https://pooldn.thebaycity.dev/api/auth/facebook/callback` with Facebook,
 * but send `https://localhost:8084/api/auth/facebook/callback` as
 * `redirect_uri` — Facebook redirects faithfully and the user lands on a URL
 * only reachable from the server itself.
 *
 * ── Why we can read forwarded headers now ────────────────────────────────
 * The Round-47 note refused to look at `X-Forwarded-Host` because those
 * headers are client-settable when the proxy doesn't strip them, so trusting
 * them on the callback path would let an attacker redirect victims (with
 * their OAuth `code`) to a domain they control.
 *
 * That reasoning holds for *unvalidated* use. Here the forwarded host is only
 * ever used to SELECT an entry from an explicit, operator-configured
 * allowlist — it is never echoed back verbatim. A spoofed header either
 * matches one of our own registered domains (harmless: the redirect goes to
 * us) or matches nothing and we fall back to the canonical origin. The
 * attacker gains no way to name a host we didn't already approve.
 *
 * ── Why per-request resolution is required, not just nicer ───────────────
 * The OAuth start route sets `g_state` / `g_verifier` / `fb_state` cookies on
 * whatever domain the browser is currently on, and the callback route reads
 * them back. If start and callback disagreed about the origin, the cookies
 * would be written on one domain and looked for on the other, and every
 * sign-in on the non-canonical domain would fail the state check.
 *
 * ── Configuration ────────────────────────────────────────────────────────
 * `NEXT_PUBLIC_APP_URL` stays the CANONICAL origin: it is the fallback when a
 * request's host isn't recognised, and it remains what off-request callers
 * (transactional email, digests — see `email.service.ts`, `digest.service.ts`)
 * use for absolute links, since a queued email has no request to read a host
 * from.
 *
 * `APP_ORIGIN_ALLOWLIST` adds further origins, comma-separated, each with an
 * explicit scheme:
 *
 *     NEXT_PUBLIC_APP_URL="https://pooldn.thebaycity.dev"
 *     APP_ORIGIN_ALLOWLIST="https://playpoolapp.com,https://www.playpoolapp.com"
 *
 * Every origin listed must ALSO be registered as an authorised redirect URI
 * with Google and Facebook, or that provider will reject the sign-in.
 */

/** Parse one configured origin. Returns null for blank/invalid entries. */
function parseOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // `.origin` normalises away paths, trailing slashes and default ports.
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Every origin this deployment answers on, canonical first.
 *
 * Read fresh on each call rather than cached at module scope: `next start`
 * and the test suite both mutate `process.env` after import, and a cached
 * list would silently serve stale config.
 */
function allowedOrigins(): string[] {
  const configured = [
    process.env.NEXT_PUBLIC_APP_URL ?? "",
    ...(process.env.APP_ORIGIN_ALLOWLIST ?? "").split(","),
  ];

  const seen = new Set<string>();
  for (const entry of configured) {
    const origin = parseOrigin(entry);
    if (origin) seen.add(origin);
  }
  return [...seen];
}

/**
 * Hosts the request might legitimately have arrived on, most-trustworthy
 * last-mile first. We check several because which one carries the public
 * hostname depends on the proxy: Cloudflare Tunnel preserves the original
 * `Host`, while nginx/Caddy typically rewrite `Host` to the upstream and put
 * the public name in `X-Forwarded-Host`.
 *
 * Each candidate is matched against the allowlist before being used, so
 * casting a wide net here costs nothing in safety.
 */
function candidateHosts(request: Request): string[] {
  const hosts: string[] = [];

  // `X-Forwarded-Host` may be a comma-separated chain when several proxies
  // are in front of us; the left-most entry is the original client-facing host.
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) hosts.push(forwarded.split(",")[0]);

  const host = request.headers.get("host");
  if (host) hosts.push(host);

  try {
    hosts.push(new URL(request.url).host);
  } catch {
    // Malformed request.url — nothing to add.
  }

  return hosts.map((h) => h.trim().toLowerCase()).filter(Boolean);
}

/**
 * The public origin to build redirect URLs and OAuth `redirect_uri`s from for
 * THIS request.
 *
 * Resolution order:
 *   1. the first request host that matches a configured origin — returned as
 *      the CONFIGURED string, so the scheme is ours and not the caller's;
 *   2. the canonical `NEXT_PUBLIC_APP_URL`, when nothing matched;
 *   3. the request's own origin, when nothing is configured at all — which is
 *      the correct behaviour for `next dev` on `http://localhost:3000`.
 */
export function appOrigin(request: Request): string {
  const allowed = allowedOrigins();
  if (allowed.length === 0) return new URL(request.url).origin;

  const byHost = new Map(allowed.map((o) => [new URL(o).host, o]));
  for (const host of candidateHosts(request)) {
    const match = byHost.get(host);
    if (match) return match;
  }

  // Unrecognised host: fall back to canonical rather than trusting it.
  return allowed[0];
}

/**
 * The canonical origin, for callers with no request in hand — queued email,
 * cron digests, anything rendered off the request path.
 */
export function canonicalOrigin(): string | null {
  return allowedOrigins()[0] ?? null;
}
