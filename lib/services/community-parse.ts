/**
 * Round-A2/A3 — community post + comment body parsing.
 *
 * - @mentions:  /@([a-z0-9_]{2,30})/gi  → list of unique usernames (lowercase)
 * - #hashtags:  /#([a-z0-9_]{2,30})/gi  → list of unique tags (lowercase)
 *
 * Both are conservative: alphanumeric + underscore, 2–30 chars, anchored on a
 * non-word boundary so URLs and emails don't get falsely shredded.
 */

const MENTION_RE = /(^|[^A-Za-z0-9_])@([a-z0-9_]{2,30})/gi;
const TAG_RE = /(^|[^A-Za-z0-9_])#([a-z0-9_]{2,30})/gi;

export function extractMentions(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) {
    out.add(m[2].toLowerCase());
  }
  return Array.from(out);
}

export function extractTags(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(TAG_RE)) {
    out.add(m[2].toLowerCase());
  }
  return Array.from(out);
}
