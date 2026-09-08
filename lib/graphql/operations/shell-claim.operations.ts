import { graphql } from "@/lib/graphql/generated";

// Round-88 — self-service claiming of shell (placeholder) profiles: the
// player's request, and the organizer's/admin's review queue.

export const RequestShellClaimMutation = graphql(/* GraphQL */ `
  mutation RequestShellClaim($shellUserId: ID!, $message: String) {
    requestShellClaim(shellUserId: $shellUserId, message: $message) {
      id
      status
      shellName
      createdAt
    }
  }
`);

export const CancelShellClaimMutation = graphql(/* GraphQL */ `
  mutation CancelShellClaim($id: ID!) {
    cancelShellClaim(id: $id) {
      id
      status
    }
  }
`);

export const ReviewShellClaimMutation = graphql(/* GraphQL */ `
  mutation ReviewShellClaim($id: ID!, $approve: Boolean!, $note: String) {
    reviewShellClaim(id: $id, approve: $approve, note: $note) {
      id
      status
      shellName
      reviewNote
      reviewedAt
    }
  }
`);

export const ShellClaimRequestsQuery = graphql(/* GraphQL */ `
  query ShellClaimRequests(
    $status: ShellClaimStatus
    $competitionId: ID
    $first: Int
  ) {
    shellClaimRequests(
      status: $status
      competitionId: $competitionId
      first: $first
    ) {
      id
      status
      message
      reviewNote
      reviewedAt
      createdAt
      shellName
      shellUsername
      viewerCanReview
      shellUser {
        id
        username
        avatarUrl
      }
      requester {
        id
        name
        username
        avatarUrl
        nationality
        createdAt
      }
      reviewedBy {
        id
        name
      }
      competitions {
        id
        name
        slug
      }
    }
  }
`);

export const PendingShellClaimCountQuery = graphql(/* GraphQL */ `
  query PendingShellClaimCount($competitionId: ID) {
    pendingShellClaimCount(competitionId: $competitionId)
  }
`);

export const MyShellClaimsQuery = graphql(/* GraphQL */ `
  query MyShellClaims {
    myShellClaims {
      id
      status
      shellName
      shellUsername
      reviewNote
      reviewedAt
      createdAt
    }
  }
`);
