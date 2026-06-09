import { builder } from "../builder";

export const SearchKindEnum = builder.enumType("SearchKind", {
  values: ["COMPETITION", "TEAM", "PLAYER", "VENUE", "POST"] as const,
});

export const SearchResultType = builder.objectRef<{
  kind: "COMPETITION" | "TEAM" | "PLAYER" | "VENUE" | "POST";
  id: string;
  slug?: string | null;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  snippet?: string | null;
  rank?: number;
}>("SearchResult").implement({
  fields: (t) => ({
    kind: t.field({
      type: SearchKindEnum,
      resolve: (r) => r.kind,
    }),
    // Back-compat alias for the previous `type` field name.
    type: t.string({ resolve: (r) => r.kind }),
    id: t.exposeString("id"),
    slug: t.exposeString("slug", { nullable: true }),
    title: t.exposeString("title"),
    subtitle: t.exposeString("subtitle", { nullable: true }),
    imageUrl: t.exposeString("imageUrl", { nullable: true }),
    // Server-rendered `ts_headline` snippet with <mark>…</mark> around the
    // matched terms. The client renders it as escaped + highlighted text.
    snippet: t.exposeString("snippet", { nullable: true }),
    rank: t.float({ nullable: true, resolve: (r) => r.rank ?? null }),
  }),
});
