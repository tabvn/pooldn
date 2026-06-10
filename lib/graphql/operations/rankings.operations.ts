import { graphql } from "@/lib/graphql/generated";

export const RankingsQuery = graphql(/* GraphQL */ `
  query Rankings($first: Int, $after: ID, $teamId: ID) {
    rankings(first: $first, after: $after, teamId: $teamId) {
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
      teams(limit: 3) {
        id
        slug
        name
        logoUrl
      }
      teamsCount
    }
  }
`);

export const RankingsTeamFilterQuery = graphql(/* GraphQL */ `
  query RankingsTeamFilter {
    teams {
      id
      slug
      name
      logoUrl
    }
  }
`);
