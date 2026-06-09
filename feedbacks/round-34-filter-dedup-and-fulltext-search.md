# PoolDN — Competitions filter dedup + Postgres full-text search (Round 34)

## 1. Competitions browse filter — remove the duplicate City filter
The header already has a **location/city selector** that scopes the app to a city. The competitions browse `<PoolhubFilters>` ALSO has a **City** dropdown — redundant and confusing.
- **Remove the City option from the competitions filter list.** Keep Search / Status / Game type.
- The browse results should be **scoped by the header's selected city** automatically (pass the header city into the `competitions` query as the city filter). If the header has "all/none" selected, show all cities.
- Apply the same principle elsewhere: don't duplicate a city filter where the header location already governs scope.

## 2. All search must use PostgreSQL full-text search
Currently search uses `contains`/`ILIKE` (e.g. competition name/slug filter, roster search, and any new global search from round-25). Replace with **Postgres full-text search** for relevance + performance:
- Add a `tsvector` search column (or use `to_tsvector`) on the searchable models (Competition: name + description; Team: name; User: name + username; Venue: name + address) with a GIN index. Query with `to_tsquery` / `plainto_tsquery` / `websearch_to_tsquery` and rank by `ts_rank`.
- Alternatively, if FTS is heavy to set up per model, use the `pg_trgm` extension with GIN trigram indexes for fast fuzzy `ILIKE`/similarity search — but the user asked for full-text search, so prefer `tsvector` + ranking; `pg_trgm` only as a complement for typo-tolerance.
- This covers: the competitions browse Search box, the **global search** (round-25, across competitions/teams/players/venues), and ideally the roster search.
- Prisma: use a generated/maintained `tsv` column updated via a trigger or in the app on write, and query via `$queryRaw` (Prisma has limited native FTS) or Prisma's `search` on Postgres text fields where available.
- Add the migration (enable extensions, create indexes) and keep `npm run db:seed` working.

## Tests
- Competitions filter has NO city dropdown; results respect the header city; switching the header city re-scopes the list.
- Full-text search returns ranked, relevance-ordered results for partial words and multiple terms; performs on the seeded data; global search spans entities.

## Definition of done
The competitions filter no longer duplicates the header city (results scoped by the header); all search uses Postgres full-text search (tsvector + GIN + ranking) with a migration; tests green.
