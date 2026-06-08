import { graphql } from "@/lib/graphql/generated";

export const ProfileByUsernameQuery = graphql(/* GraphQL */ `
  query ProfileByUsername($username: String!) {
    userByUsername(username: $username) {
      id
      name
      username
      email
      role
      bio
      nationality
      avatarUrl
      createdAt
      city {
        id
        name
        country {
          id
          name
        }
      }
    }
  }
`);

export const ViewerSettingsQuery = graphql(/* GraphQL */ `
  query ViewerSettings {
    viewer {
      id
      name
      username
      email
      bio
      nationality
      phone
      avatarUrl
      city {
        id
        name
      }
    }
    cities {
      id
      name
      country {
        name
        code
      }
    }
  }
`);

export const UpdateProfileMutation = graphql(/* GraphQL */ `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      name
      bio
      nationality
      phone
      avatarUrl
      city {
        id
        name
      }
    }
  }
`);
