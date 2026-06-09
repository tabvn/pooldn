import Link from "next/link";
import React from "react";

/**
 * Round-A2/A3 — renders a community body string with:
 *   - @username  → /players/<username>
 *   - #tag       → /community?tag=<tag>
 *   - http(s)://… → external link (rel=noopener)
 *
 * Tokens are recognized by the same regexes used server-side
 * (lib/services/community-parse.ts) so behavior stays consistent.
 */
const TOKEN_RE = /(@[a-z0-9_]{2,30})|(#[a-z0-9_]{2,30})|(https?:\/\/[^\s<>"']+)/gi;

export function CommunityRichText({ body }: { body: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const m of body.matchAll(TOKEN_RE)) {
    if (m.index === undefined) continue;
    if (m.index > lastIndex) {
      parts.push(body.slice(lastIndex, m.index));
    }
    const tok = m[0];
    const prevChar = m.index === 0 ? "" : body[m.index - 1];
    const isWordEdge = !prevChar || /\W/.test(prevChar);
    if (!isWordEdge && (tok.startsWith("@") || tok.startsWith("#"))) {
      // Avoid eating email locals like "you@example.com" into a mention.
      parts.push(tok);
    } else if (tok.startsWith("@")) {
      const username = tok.slice(1).toLowerCase();
      parts.push(
        <Link
          key={`m-${key++}`}
          href={`/players/${username}`}
          className="font-semibold text-primary hover:underline"
        >
          {tok}
        </Link>,
      );
    } else if (tok.startsWith("#")) {
      const tag = tok.slice(1).toLowerCase();
      parts.push(
        <Link
          key={`t-${key++}`}
          href={`/community?tag=${encodeURIComponent(tag)}`}
          className="font-semibold text-info hover:underline"
        >
          {tok}
        </Link>,
      );
    } else {
      parts.push(
        <a
          key={`u-${key++}`}
          href={tok}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline break-all"
        >
          {tok}
        </a>,
      );
    }
    lastIndex = m.index + tok.length;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }
  return <span className="whitespace-pre-wrap">{parts}</span>;
}
