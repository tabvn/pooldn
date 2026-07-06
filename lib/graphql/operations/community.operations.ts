import { graphql } from "@/lib/graphql/generated";

// Community "Players" tab — players in the active city (location-scoped
// directory). Ordered newest-first by the resolver. This is the only thing
// the Community page renders now; the post feed/trending were removed.
export const CityPlayersQuery = graphql(/* GraphQL */ `
  query CityPlayers($cityId: ID, $first: Int) {
    users(cityId: $cityId, first: $first) {
      id
      name
      username
      avatarUrl
      nationality
      role
      city {
        id
        name
      }
    }
  }
`);
