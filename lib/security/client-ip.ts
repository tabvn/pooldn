/**
 * Round-47 — derive the real client IP from a Fetch Request.
 *
 * Precedence (most-trusted first):
 *   1. `cf-connecting-ip`           — Cloudflare injects this; can't be spoofed
 *                                      because Cloudflare strips inbound copies.
 *   2. `x-vercel-forwarded-for`     — Vercel's equivalent.
 *   3. `x-real-ip`                  — reverse-proxy convention.
 *   4. `x-forwarded-for`            — left-most entry only. Spoofable if not
 *                                      behind a trusted proxy, so this is the
 *                                      LAST hop we check.
 *
 * Returns `"unknown"` when none of the above is set — keep rate-limit keys
 * stable even for direct local hits during dev.
 */
export function getClientIp(req: Request): string {
  const h = req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const vercel = h.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}

/**
 * Country code (ISO-3166-1 alpha-2) from Cloudflare's `cf-ipcountry`. Returns
 * null when not behind Cloudflare. Don't BLOCK on this — false positives
 * happen — but it's useful in the SecurityEvent log.
 */
export function getCountry(req: Request): string | null {
  const c = req.headers.get("cf-ipcountry");
  return c && c !== "XX" && c !== "T1" ? c.toUpperCase() : null;
}
