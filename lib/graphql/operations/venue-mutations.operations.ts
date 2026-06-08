import { graphql } from "@/lib/graphql/generated";

export const CreateVenueMutation = graphql(/* GraphQL */ `
  mutation CreateVenue($input: CreateVenueInput!) {
    createVenue(input: $input) {
      id
      slug
      name
    }
  }
`);

export const UpdateVenueMutation = graphql(/* GraphQL */ `
  mutation UpdateVenue($id: ID!, $input: UpdateVenueInput!) {
    updateVenue(id: $id, input: $input) {
      id
      slug
      name
      address
      phone
      email
      website
      imageUrl
      tableCount
      isActive
    }
  }
`);

export const DeleteVenueMutation = graphql(/* GraphQL */ `
  mutation DeleteVenue($id: ID!) {
    deleteVenue(id: $id)
  }
`);
