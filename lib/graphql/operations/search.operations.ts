import { graphql } from "@/lib/graphql/generated";

export const GlobalSearchQuery = graphql(/* GraphQL */ `
  query GlobalSearch($q: String!, $perKind: Int, $kinds: [SearchKind!]) {
    search(q: $q, perKind: $perKind, kinds: $kinds) {
      kind
      id
      slug
      title
      subtitle
      snippet
      imageUrl
      rank
    }
  }
`);
