import { graphql } from "@/lib/graphql/generated";

export const RankingsQuery = graphql(/* GraphQL */ `
  query Rankings($first: Int, $after: ID) {
    rankings(first: $first, after: $after) {
      id
      name
      username
      avatarUrl
      nationality
      rating
      level
      city {
        id
        name
      }
    }
  }
`);
