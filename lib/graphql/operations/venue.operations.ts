import { graphql } from "@/lib/graphql/generated";

export const VenuesListQuery = graphql(/* GraphQL */ `
  query VenuesList($cityId: ID) {
    venues(cityId: $cityId) {
      id
      slug
      name
      address
      imageUrl
      tableCount
      isActive
      city {
        id
        name
      }
    }
    cities {
      id
      name
    }
  }
`);

export const VenueDetailQuery = graphql(/* GraphQL */ `
  query VenueDetail($slug: String!) {
    venue(slug: $slug) {
      id
      slug
      name
      address
      imageUrl
      tableCount
      phone
      email
      website
      city {
        id
        name
      }
    }
  }
`);
