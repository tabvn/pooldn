import { graphql } from "@/lib/graphql/generated";

export const CreateCompetitionMutation = graphql(/* GraphQL */ `
  mutation CreateCompetition($input: CreateCompetitionInput!) {
    createCompetition(input: $input) {
      id
      slug
      name
      status
    }
  }
`);

export const PublishCompetitionMutation = graphql(/* GraphQL */ `
  mutation PublishCompetition($id: ID!) {
    publishCompetition(id: $id) {
      id
      status
    }
  }
`);

export const CloseApplicationsMutation = graphql(/* GraphQL */ `
  mutation CloseApplications($id: ID!) {
    closeApplications(id: $id) {
      id
      status
    }
  }
`);

export const StartCompetitionMutation = graphql(/* GraphQL */ `
  mutation StartCompetition($id: ID!) {
    startCompetition(id: $id) {
      id
      status
    }
  }
`);

export const CompleteCompetitionMutation = graphql(/* GraphQL */ `
  mutation CompleteCompetition($id: ID!) {
    completeCompetition(id: $id) {
      id
      status
    }
  }
`);

export const CancelCompetitionMutation = graphql(/* GraphQL */ `
  mutation CancelCompetition($id: ID!) {
    cancelCompetition(id: $id) {
      id
      status
    }
  }
`);

export const UpdateCompetitionMutation = graphql(/* GraphQL */ `
  mutation UpdateCompetition($id: ID!, $input: UpdateCompetitionInput!) {
    updateCompetition(id: $id, input: $input) {
      id
      slug
      name
      status
      bannerUrl
      description
    }
  }
`);

export const DeleteCompetitionMutation = graphql(/* GraphQL */ `
  mutation DeleteCompetition($id: ID!) {
    deleteCompetition(id: $id)
  }
`);

export const ReopenCompetitionMutation = graphql(/* GraphQL */ `
  mutation ReopenCompetition($id: ID!) {
    reopenCompetition(id: $id) {
      id
      status
    }
  }
`);

export const ReopenCancelledCompetitionMutation = graphql(/* GraphQL */ `
  mutation ReopenCancelledCompetition($id: ID!) {
    reopenCancelledCompetition(id: $id) {
      id
      status
    }
  }
`);

export const ApplyToCompetitionMutation = graphql(/* GraphQL */ `
  mutation ApplyToCompetition($input: ApplyToCompetitionInput!) {
    applyToCompetition(input: $input) {
      id
      status
      team {
        id
        name
      }
    }
  }
`);

export const ReviewApplicationMutation = graphql(/* GraphQL */ `
  mutation ReviewApplication($input: ReviewApplicationInput!) {
    reviewApplication(input: $input) {
      id
      status
      reviewNote
      reviewedAt
    }
  }
`);

export const WithdrawApplicationMutation = graphql(/* GraphQL */ `
  mutation WithdrawApplication($id: ID!) {
    withdrawApplication(id: $id) {
      id
      status
    }
  }
`);

export const EditApplicationRosterMutation = graphql(/* GraphQL */ `
  mutation EditApplicationRoster(
    $id: ID!
    $playerUserIds: [ID!]!
    $rosterCaptainUserId: ID
  ) {
    editApplicationRoster(
      id: $id
      playerUserIds: $playerUserIds
      rosterCaptainUserId: $rosterCaptainUserId
    ) {
      id
      status
      applicationPlayers {
        id
        user {
          id
          name
        }
      }
    }
  }
`);

export const InviteTeamsToCompetitionMutation = graphql(/* GraphQL */ `
  mutation InviteTeamsToCompetition(
    $competitionId: ID!
    $teamIds: [ID!]!
    $personalNote: String
  ) {
    inviteTeamsToCompetition(
      competitionId: $competitionId
      teamIds: $teamIds
      personalNote: $personalNote
    ) {
      id
      status
      team {
        id
        name
        slug
      }
    }
  }
`);

// Round-77 — applicant ↔ organizer conversation on an application.
export const ApplicationThreadQuery = graphql(/* GraphQL */ `
  query ApplicationThread($id: ID!) {
    competitionApplication(id: $id) {
      id
      status
      messageCount
      unreadMessageCount
      messages {
        id
        body
        createdAt
        author {
          id
          name
          username
          avatarUrl
        }
      }
    }
  }
`);

export const PostApplicationMessageMutation = graphql(/* GraphQL */ `
  mutation PostApplicationMessage($applicationId: ID!, $body: String!) {
    postApplicationMessage(applicationId: $applicationId, body: $body) {
      id
      body
      createdAt
      author {
        id
        name
        username
        avatarUrl
      }
    }
  }
`);

// Round-77 — clears the viewer's Messages badge. Returns the application so
// Apollo normalises the new counts straight into whatever list is on screen.
export const MarkApplicationThreadReadMutation = graphql(/* GraphQL */ `
  mutation MarkApplicationThreadRead($applicationId: ID!) {
    markApplicationThreadRead(applicationId: $applicationId) {
      id
      messageCount
      unreadMessageCount
    }
  }
`);

// Round-76 — Singles (INDIVIDUAL) comps invite players, not teams.
export const InvitePlayersToCompetitionMutation = graphql(/* GraphQL */ `
  mutation InvitePlayersToCompetition(
    $competitionId: ID!
    $userIds: [ID!]!
    $personalNote: String
  ) {
    invitePlayersToCompetition(
      competitionId: $competitionId
      userIds: $userIds
      personalNote: $personalNote
    ) {
      id
      status
      applicant {
        id
        name
        username
      }
    }
  }
`);

// Round-50 — organizer/admin lock toggles + captain-initiated roster change
// requests that require organizer review.
export const SetCompetitionLocksMutation = graphql(/* GraphQL */ `
  mutation SetCompetitionLocks(
    $id: ID!
    $registrationLocked: Boolean
    $rosterLocked: Boolean
  ) {
    setCompetitionLocks(
      id: $id
      registrationLocked: $registrationLocked
      rosterLocked: $rosterLocked
    ) {
      id
      registrationLocked
      rosterLocked
    }
  }
`);

export const RequestRosterChangeMutation = graphql(/* GraphQL */ `
  mutation RequestRosterChange(
    $applicationId: ID!
    $playerUserIds: [ID!]!
    $message: String
    $rosterCaptainUserId: ID
  ) {
    requestRosterChange(
      applicationId: $applicationId
      playerUserIds: $playerUserIds
      message: $message
      rosterCaptainUserId: $rosterCaptainUserId
    ) {
      id
      status
      submittedAt
    }
  }
`);

export const CancelRosterChangeRequestMutation = graphql(/* GraphQL */ `
  mutation CancelRosterChangeRequest($id: ID!) {
    cancelRosterChangeRequest(id: $id) {
      id
      status
    }
  }
`);

export const DecideRosterChangeRequestMutation = graphql(/* GraphQL */ `
  mutation DecideRosterChangeRequest(
    $id: ID!
    $approve: Boolean!
    $reviewNote: String
  ) {
    decideRosterChangeRequest(
      id: $id
      approve: $approve
      reviewNote: $reviewNote
    ) {
      id
      status
      reviewNote
      reviewedAt
    }
  }
`);

// Round-93 — destructive counterpart to WithdrawApplicationMutation: removes
// the participant AND every match they were in, then recalculates points.
export const RemoveParticipantMutation = graphql(/* GraphQL */ `
  mutation RemoveParticipant($applicationId: ID!) {
    removeParticipant(applicationId: $applicationId) {
      participantName
      matchesDeleted
      playedMatchesDeleted
      matchdaysRemoved
    }
  }
`);
