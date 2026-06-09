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
      rating
      level
      rank
      isFollowing
      followerCount
      followingCount
      bannedAt
      banReason
      playerCompStats {
        id
        matchesPlayed
        framesWon
        framesPlayed
        winRate
        isMvp
        competition {
          id
          slug
          name
          status
          bannerUrl
          startDate
          endDate
          gameType
        }
      }
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
      emailVerified
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

export const ChangePasswordMutation = graphql(/* GraphQL */ `
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`);

export const ResendEmailVerificationMutation = graphql(/* GraphQL */ `
  mutation ResendEmailVerification {
    resendEmailVerification
  }
`);

export const VerifyEmailTokenMutation = graphql(/* GraphQL */ `
  mutation VerifyEmailToken($token: String!) {
    verifyEmailToken(token: $token)
  }
`);

export const ChangeEmailMutation = graphql(/* GraphQL */ `
  mutation ChangeEmail($newEmail: String!, $currentPassword: String!) {
    changeEmail(newEmail: $newEmail, currentPassword: $currentPassword) {
      id
      email
    }
  }
`);

export const AdminUpdateUserMutation = graphql(/* GraphQL */ `
  mutation AdminUpdateUser(
    $id: ID!
    $name: String
    $bio: String
    $nationality: String
    $role: String
    $isActive: Boolean
  ) {
    adminUpdateUser(
      id: $id
      name: $name
      bio: $bio
      nationality: $nationality
      role: $role
      isActive: $isActive
    ) {
      id
      name
      role
      bio
      nationality
      isActive
    }
  }
`);

export const DeactivateAccountMutation = graphql(/* GraphQL */ `
  mutation DeactivateAccount(
    $currentPassword: String!
    $confirmUsername: String!
  ) {
    deactivateAccount(
      currentPassword: $currentPassword
      confirmUsername: $confirmUsername
    )
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
