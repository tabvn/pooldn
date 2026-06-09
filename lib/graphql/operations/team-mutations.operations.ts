import { graphql } from "@/lib/graphql/generated";

export const CreateTeamMutation = graphql(/* GraphQL */ `
  mutation CreateTeam($input: CreateTeamInput!) {
    createTeam(input: $input) {
      id
      slug
      name
      logoUrl
    }
  }
`);

export const AddTeamMemberMutation = graphql(/* GraphQL */ `
  mutation AddTeamMember($teamId: ID!, $userId: ID!) {
    addTeamMember(teamId: $teamId, userId: $userId) {
      id
      user {
        id
        name
        username
      }
    }
  }
`);

export const UpdateTeamMutation = graphql(/* GraphQL */ `
  mutation UpdateTeam($id: ID!, $input: UpdateTeamInput!) {
    updateTeam(id: $id, input: $input) {
      id
      slug
      name
      description
      logoUrl
      isActive
    }
  }
`);

export const DeleteTeamMutation = graphql(/* GraphQL */ `
  mutation DeleteTeam($id: ID!) {
    deleteTeam(id: $id)
  }
`);

export const RemoveTeamMemberMutation = graphql(/* GraphQL */ `
  mutation RemoveTeamMember($teamId: ID!, $userId: ID!) {
    removeTeamMember(teamId: $teamId, userId: $userId)
  }
`);

export const UsersDirectoryQuery = graphql(/* GraphQL */ `
  query UsersDirectory {
    users {
      id
      name
      username
      avatarUrl
      nationality
      role
    }
  }
`);
