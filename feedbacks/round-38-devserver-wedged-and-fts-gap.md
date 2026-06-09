# PoolDN — Dev server wedged + round-34 FTS still ILIKE (Round 38)

## 1. URGENT: dev server is wedged → restart it
Right now **every page returns HTTP 500** with:
```
lib/graphql/schema.ts:41 — Module not found: Can't resolve './resolvers/search'
```
But `lib/graphql/resolvers/search.ts` **already exists and is valid**. Root cause: the `import "./resolvers/search"` line was added to `schema.ts` **before** the file was created, so Next's dev-server webpack resolver cached the negative resolution. Touching/re-saving `schema.ts` does **not** clear it — webpack's in-memory negative cache survives HMR.

**Fix:** restart the dev server (kill `next dev` and re-run `npm run dev`), or `rm -rf .next/cache` then restart. After that the app compiles cleanly and all pages recover.

**Prevention:** when adding a barrel/import for a new module, create the file first (even a stub) *then* add the import, so the dev server never caches a miss.

## 2. round-34 part 2 NOT done: search still uses ILIKE, not Postgres full-text
`resolvers/search.ts` uses `{ contains: q, mode: "insensitive" }` (ILIKE) for competitions/teams/players/venues. Round-34 explicitly required **Postgres full-text search**: `tsvector` columns + GIN indexes + `websearch_to_tsquery`/`plainto_tsquery` ranked by `ts_rank`. No `tsvector`/`to_tsquery`/`pg_trgm` exists anywhere and there's no FTS migration.
- Add the tsvector columns (Competition: name+description; Team: name; User: name+username; Venue: name+address) with GIN indexes via a migration, maintained by trigger or on-write.
- Query via `$queryRaw` with `websearch_to_tsquery` and order by `ts_rank` so multi-term + partial-word + relevance ranking works.
- Keep the unified `SearchResult` shape; keep `npm run db:seed` working.

## Definition of done
Dev server restarted and app serving 200s again; global search backed by Postgres FTS (tsvector+GIN+rank) with a migration; tests green.
