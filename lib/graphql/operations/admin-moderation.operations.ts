import { graphql } from "@/lib/graphql/generated";

export const BannedUsersQuery = graphql(/* GraphQL */ `
  query BannedUsers($first: Int, $after: ID) {
    bannedUsers(first: $first, after: $after) {
      id
      name
      username
      avatarUrl
      role
      banReason
      bannedAt
      email
    }
  }
`);

export const BannedTeamsQuery = graphql(/* GraphQL */ `
  query BannedTeams($first: Int, $after: ID) {
    bannedTeams(first: $first, after: $after) {
      id
      slug
      name
      logoUrl
      bannedAt
      banReason
      captain {
        id
        name
        username
      }
    }
  }
`);

export const BanUserMutation = graphql(/* GraphQL */ `
  mutation BanUser($id: ID!, $reason: String) {
    banUser(id: $id, reason: $reason) {
      id
      bannedAt
      banReason
    }
  }
`);

export const UnbanUserMutation = graphql(/* GraphQL */ `
  mutation UnbanUser($id: ID!) {
    unbanUser(id: $id) {
      id
      bannedAt
    }
  }
`);

export const BanTeamMutation = graphql(/* GraphQL */ `
  mutation BanTeam($id: ID!, $reason: String) {
    banTeam(id: $id, reason: $reason) {
      id
      bannedAt
      banReason
    }
  }
`);

export const UnbanTeamMutation = graphql(/* GraphQL */ `
  mutation UnbanTeam($id: ID!) {
    unbanTeam(id: $id) {
      id
      bannedAt
    }
  }
`);

export const DeleteTeamHardMutation = graphql(/* GraphQL */ `
  mutation DeleteTeamHard($id: ID!) {
    deleteTeamHard(id: $id)
  }
`);
