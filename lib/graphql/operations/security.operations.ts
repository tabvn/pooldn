import { graphql } from "@/lib/graphql/generated";

export const SecurityEventsQuery = graphql(/* GraphQL */ `
  query SecurityEvents($kind: String, $first: Int, $after: ID) {
    securityEvents(kind: $kind, first: $first, after: $after) {
      id
      kind
      identifier
      ip
      country
      note
      createdAt
      user {
        id
        name
        username
        avatarUrl
      }
    }
  }
`);
