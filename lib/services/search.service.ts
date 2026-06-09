import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Round-34 — full-text search service.
 *
 * Each entity has a generated `searchVector` tsvector column (see the
 * 20260609020000_search_fts_indexes migration). We query it with
 * `websearch_to_tsquery('simple', $q)` so users can write Google-style
 * phrases ("spring open", `"da nang"`, `pool -final`) and get sensible
 * results.
 *
 * The ranking score is `ts_rank_cd(searchVector, query)` per row; we also
 * generate a snippet via `ts_headline` so the UI can highlight matches.
 *
 * We deliberately keep every entity's query isolated (one SQL per kind) for
 * three reasons:
 *   1. Each entity returns different shapes and CASL-relevant filters.
 *   2. Postgres can plan each query with its own GIN index — no UNION ALL
 *      planner gymnastics.
 *   3. The caller decides the per-kind cap (typically 5 for the topbar,
 *      20 for the dedicated /search page).
 */

export type SearchKind = "COMPETITION" | "TEAM" | "PLAYER" | "VENUE" | "POST";

export type SearchHit = {
  kind: SearchKind;
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  snippet: string | null;
  imageUrl: string | null;
  rank: number;
};

const HEADLINE_OPTS =
  "MaxFragments=1,MinWords=4,MaxWords=14,StartSel=<mark>,StopSel=</mark>";

/**
 * Defensive input sanitizer for the FTS query string.
 *
 * SQL injection is structurally impossible here — the query parameters go
 * through the PG wire protocol via `$1`/`$2`/`$3` placeholders, never
 * concatenated into the SQL string. This function exists for cheap defense
 * in depth:
 *
 *   - strip ASCII control chars + null bytes (could break SSE response if
 *     they leak into a snippet)
 *   - strip zero-width spacers (used in homograph attacks)
 *   - cap at 100 chars (websearch_to_tsquery parses runaway input anyway,
 *     but this protects the downstream `ts_headline` snippet length)
 */
function trim(q: string): string {
  return q
    // strip ASCII control chars + null bytes
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, " ")
    // strip zero-width / bidi control characters (homograph attacks)
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "")
    .trim()
    .slice(0, 100);
}

async function competitions(
  prisma: PrismaClient,
  q: string,
  limit: number,
): Promise<SearchHit[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      slug: string;
      name: string;
      bannerUrl: string | null;
      status: string;
      city_name: string | null;
      snippet: string;
      rank: number;
    }>
  >(
    `
      SELECT c.id, c.slug, c.name, c."bannerUrl", c.status,
             ci.name AS city_name,
             ts_headline('simple', coalesce(c.description, c.name), websearch_to_tsquery('simple', $1), $3) AS snippet,
             ts_rank_cd(c."searchVector", websearch_to_tsquery('simple', $1)) AS rank
        FROM competitions c
        LEFT JOIN cities ci ON ci.id = c."cityId"
       WHERE c."searchVector" @@ websearch_to_tsquery('simple', $1)
         AND c."isPublic" = true
       ORDER BY rank DESC, c."createdAt" DESC
       LIMIT $2
    `,
    q,
    limit,
    HEADLINE_OPTS,
  );
  return rows.map((r) => ({
    kind: "COMPETITION" as const,
    id: r.id,
    slug: r.slug,
    title: r.name,
    subtitle: [r.status.replace(/_/g, " ").toLowerCase(), r.city_name]
      .filter(Boolean)
      .join(" · "),
    snippet: r.snippet,
    imageUrl: r.bannerUrl,
    rank: r.rank,
  }));
}

async function teams(
  prisma: PrismaClient,
  q: string,
  limit: number,
): Promise<SearchHit[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      slug: string;
      name: string;
      logoUrl: string | null;
      captain_username: string | null;
      snippet: string;
      rank: number;
    }>
  >(
    `
      SELECT t.id, t.slug, t.name, t."logoUrl",
             u.username AS captain_username,
             ts_headline('simple', coalesce(t.description, t.name), websearch_to_tsquery('simple', $1), $3) AS snippet,
             ts_rank_cd(t."searchVector", websearch_to_tsquery('simple', $1)) AS rank
        FROM teams t
        LEFT JOIN users u ON u.id = t."captainId"
       WHERE t."searchVector" @@ websearch_to_tsquery('simple', $1)
         AND t."isActive" = true
       ORDER BY rank DESC, t.name ASC
       LIMIT $2
    `,
    q,
    limit,
    HEADLINE_OPTS,
  );
  return rows.map((r) => ({
    kind: "TEAM" as const,
    id: r.id,
    slug: r.slug,
    title: r.name,
    subtitle: r.captain_username ? `Captain @${r.captain_username}` : null,
    snippet: r.snippet,
    imageUrl: r.logoUrl,
    rank: r.rank,
  }));
}

async function players(
  prisma: PrismaClient,
  q: string,
  limit: number,
): Promise<SearchHit[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      username: string;
      name: string;
      avatarUrl: string | null;
      role: string;
      snippet: string;
      rank: number;
    }>
  >(
    `
      SELECT u.id, u.username, u.name, u."avatarUrl", u.role,
             ts_headline('simple', coalesce(u.bio, u.name), websearch_to_tsquery('simple', $1), $3) AS snippet,
             ts_rank_cd(u."searchVector", websearch_to_tsquery('simple', $1)) AS rank
        FROM users u
       WHERE u."searchVector" @@ websearch_to_tsquery('simple', $1)
         AND u."isActive" = true
         AND u.role <> 'VIEWER'
       ORDER BY rank DESC, u.name ASC
       LIMIT $2
    `,
    q,
    limit,
    HEADLINE_OPTS,
  );
  return rows.map((r) => ({
    kind: "PLAYER" as const,
    id: r.id,
    slug: r.username,
    title: r.name,
    subtitle: `@${r.username} · ${r.role.toLowerCase().replace(/_/g, " ")}`,
    snippet: r.snippet,
    imageUrl: r.avatarUrl,
    rank: r.rank,
  }));
}

async function venues(
  prisma: PrismaClient,
  q: string,
  limit: number,
): Promise<SearchHit[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      slug: string;
      name: string;
      imageUrl: string | null;
      city_name: string | null;
      snippet: string;
      rank: number;
    }>
  >(
    `
      SELECT v.id, v.slug, v.name, v."imageUrl",
             ci.name AS city_name,
             ts_headline('simple', coalesce(v.address, v.name), websearch_to_tsquery('simple', $1), $3) AS snippet,
             ts_rank_cd(v."searchVector", websearch_to_tsquery('simple', $1)) AS rank
        FROM venues v
        LEFT JOIN cities ci ON ci.id = v."cityId"
       WHERE v."searchVector" @@ websearch_to_tsquery('simple', $1)
         AND v."isActive" = true
       ORDER BY rank DESC, v.name ASC
       LIMIT $2
    `,
    q,
    limit,
    HEADLINE_OPTS,
  );
  return rows.map((r) => ({
    kind: "VENUE" as const,
    id: r.id,
    slug: r.slug,
    title: r.name,
    subtitle: r.city_name,
    snippet: r.snippet,
    imageUrl: r.imageUrl,
    rank: r.rank,
  }));
}

async function posts(
  prisma: PrismaClient,
  q: string,
  limit: number,
): Promise<SearchHit[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      body: string;
      author_username: string | null;
      author_name: string | null;
      author_avatar: string | null;
      snippet: string;
      rank: number;
    }>
  >(
    `
      SELECT p.id, p.body,
             u.username AS author_username,
             u.name AS author_name,
             u."avatarUrl" AS author_avatar,
             ts_headline('simple', p.body, websearch_to_tsquery('simple', $1), $3) AS snippet,
             ts_rank_cd(p."searchVector", websearch_to_tsquery('simple', $1)) AS rank
        FROM community_posts p
        JOIN users u ON u.id = p."authorId"
       WHERE p."searchVector" @@ websearch_to_tsquery('simple', $1)
         AND p."isHidden" = false
       ORDER BY rank DESC, p."createdAt" DESC
       LIMIT $2
    `,
    q,
    limit,
    HEADLINE_OPTS,
  );
  return rows.map((r) => ({
    kind: "POST" as const,
    id: r.id,
    slug: r.id, // posts deep-link by id
    title: r.author_name
      ? `${r.author_name} (@${r.author_username})`
      : "Community post",
    subtitle: null,
    snippet: r.snippet,
    imageUrl: r.author_avatar,
    rank: r.rank,
  }));
}

export type SearchOptions = {
  /** Per-bucket cap. */
  perKind?: number;
  /** Restrict to a single entity kind. Defaults to all. */
  kinds?: SearchKind[];
};

export async function search(
  prisma: PrismaClient,
  rawQ: string,
  opts: SearchOptions = {},
): Promise<SearchHit[]> {
  const q = trim(rawQ);
  if (q.length < 2) return [];
  const perKind = Math.min(Math.max(opts.perKind ?? 5, 1), 50);
  const wanted = new Set<SearchKind>(
    opts.kinds && opts.kinds.length > 0
      ? opts.kinds
      : ["COMPETITION", "TEAM", "PLAYER", "VENUE", "POST"],
  );
  const tasks: Promise<SearchHit[]>[] = [];
  if (wanted.has("COMPETITION")) tasks.push(competitions(prisma, q, perKind));
  if (wanted.has("TEAM")) tasks.push(teams(prisma, q, perKind));
  if (wanted.has("PLAYER")) tasks.push(players(prisma, q, perKind));
  if (wanted.has("VENUE")) tasks.push(venues(prisma, q, perKind));
  if (wanted.has("POST")) tasks.push(posts(prisma, q, perKind));
  const buckets = await Promise.all(tasks);
  return buckets.flat();
}
