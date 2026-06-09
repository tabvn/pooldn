import { builder } from "../builder";
import { SearchKindEnum, SearchResultType } from "../types/search";
import { search } from "@/lib/services/search.service";

/**
 * Round-34 — unified full-text search.
 *
 * Backed by Postgres `tsvector` columns + GIN indexes (see migration
 * 20260609020000_search_fts_indexes). Returns ranked + snippeted hits across
 * Competitions, Teams, Players (Users), Venues, and Community Posts.
 *
 * Callers:
 *   - Topbar GlobalSearch dropdown (perKind=5, all kinds)
 *   - Cmd+K command palette (same)
 *   - /search page with optional kind filter (perKind=20)
 */
builder.queryFields((t) => ({
  search: t.field({
    type: [SearchResultType],
    description:
      "Postgres FTS across competitions, teams, players, venues and posts. Returns ranked hits with <mark>…</mark> snippet highlights.",
    args: {
      q: t.arg.string({ required: true }),
      perKind: t.arg.int({ defaultValue: 5 }),
      kinds: t.arg({ type: [SearchKindEnum] }),
    },
    resolve: (_root, args, ctx) =>
      search(ctx.prisma, args.q, {
        perKind: args.perKind ?? 5,
        kinds: args.kinds ?? undefined,
      }),
  }),
}));
