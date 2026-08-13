import { graphql } from "@/lib/graphql/generated";

// Round-75 — claim a shell profile.

export const ClaimPreviewQuery = graphql(/* GraphQL */ `
  query ClaimPreview($token: String!) {
    claimPreview(token: $token) {
      name
      username
      avatarUrl
      teams
      competitions
      matchesPlayed
      framesPlayed
      framesWon
    }
  }
`);

export const ClaimProfileMutation = graphql(/* GraphQL */ `
  mutation ClaimProfile($input: ClaimProfileInput!) {
    claimProfile(input: $input) {
      token
      user {
        id
        username
      }
    }
  }
`);
