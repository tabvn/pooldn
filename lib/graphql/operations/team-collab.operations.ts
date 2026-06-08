import { graphql } from "@/lib/graphql/generated";

export const TeamInvitationsQuery = graphql(/* GraphQL */ `
  query TeamInvitations($teamId: ID!) {
    teamInvitations(teamId: $teamId) {
      id
      status
      email
      message
      createdAt
      invitedUser {
        id
        name
        username
        avatarUrl
      }
    }
  }
`);

export const TeamJoinRequestsQuery = graphql(/* GraphQL */ `
  query TeamJoinRequests($teamId: ID!) {
    teamJoinRequests(teamId: $teamId) {
      id
      status
      message
      createdAt
      user {
        id
        name
        username
        avatarUrl
      }
    }
  }
`);

export const MyTeamInvitationsQuery = graphql(/* GraphQL */ `
  query MyTeamInvitations {
    myTeamInvitations {
      id
      status
      message
      token
      createdAt
      team {
        id
        slug
        name
        logoUrl
      }
      invitedBy {
        id
        name
        username
      }
    }
  }
`);

export const InviteToTeamMutation = graphql(/* GraphQL */ `
  mutation InviteToTeam(
    $teamId: ID!
    $userId: ID
    $username: String
    $email: String
    $message: String
  ) {
    inviteToTeam(
      teamId: $teamId
      userId: $userId
      username: $username
      email: $email
      message: $message
    ) {
      id
      status
    }
  }
`);

export const CancelTeamInvitationMutation = graphql(/* GraphQL */ `
  mutation CancelTeamInvitation($id: ID!) {
    cancelTeamInvitation(id: $id) {
      id
      status
    }
  }
`);

export const RespondToInvitationMutation = graphql(/* GraphQL */ `
  mutation RespondToInvitation($id: ID, $token: String, $accept: Boolean!) {
    respondToInvitation(id: $id, token: $token, accept: $accept) {
      id
      status
    }
  }
`);

export const RequestToJoinTeamMutation = graphql(/* GraphQL */ `
  mutation RequestToJoinTeam($teamId: ID!, $message: String) {
    requestToJoinTeam(teamId: $teamId, message: $message) {
      id
      status
    }
  }
`);

export const ReviewJoinRequestMutation = graphql(/* GraphQL */ `
  mutation ReviewJoinRequest($id: ID!, $approve: Boolean!) {
    reviewJoinRequest(id: $id, approve: $approve) {
      id
      status
    }
  }
`);

export const LeaveTeamMutation = graphql(/* GraphQL */ `
  mutation LeaveTeam($teamId: ID!) {
    leaveTeam(teamId: $teamId)
  }
`);
