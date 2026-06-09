import { graphql } from "@/lib/graphql/generated";

export const MatchDetailQuery = graphql(/* GraphQL */ `
  query MatchDetail($id: ID!) {
    match(id: $id) {
      id
      status
      homeScore
      awayScore
      scheduledAt
      completedAt
      completionMode
      completedBy {
        id
        name
        username
        avatarUrl
      }
      homeTeam {
        id
        name
        slug
        logoUrl
        captain {
          id
          username
        }
      }
      awayTeam {
        id
        name
        slug
        logoUrl
        captain {
          id
          username
        }
      }
      venue {
        id
        name
      }
      frames {
        id
        frameNumber
        blockType
        homeWon
        isWalkover
        homePlayer
        awayPlayer
        homePlayerRef {
          id
          name
          avatarUrl
        }
        awayPlayerRef {
          id
          name
          avatarUrl
        }
      }
      matchday {
        id
        number
        competition {
          id
          slug
          name
          bannerUrl
          raceToFrames
          breakAndRunRule
          organizer {
            id
          }
          blocks {
            id
            order
            type
            games
            raceTo
            breakAfterMin
          }
        }
      }
      winType
      forfeitTeamId
      forfeitReason
      homeLineupSubmittedAt
      awayLineupSubmittedAt
      bothLineupsSubmitted
      lineupEditRequestedAt
      lineupEditRequestedById
      lineupEditRequestedSide
    }
  }
`);

export const SubmitLineupMutation = graphql(/* GraphQL */ `
  mutation SubmitLineup($input: SubmitLineupInput!) {
    submitLineup(input: $input) {
      id
      homeLineupSubmittedAt
      awayLineupSubmittedAt
      bothLineupsSubmitted
    }
  }
`);

export const RequestLineupEditMutation = graphql(/* GraphQL */ `
  mutation RequestLineupEdit($matchId: ID!) {
    requestLineupEdit(matchId: $matchId) {
      id
      lineupEditRequestedAt
      lineupEditRequestedById
      lineupEditRequestedSide
    }
  }
`);

export const ApproveLineupEditMutation = graphql(/* GraphQL */ `
  mutation ApproveLineupEdit($matchId: ID!) {
    approveLineupEdit(matchId: $matchId) {
      id
      homeLineupSubmittedAt
      awayLineupSubmittedAt
      lineupEditRequestedAt
    }
  }
`);

export const RejectLineupEditMutation = graphql(/* GraphQL */ `
  mutation RejectLineupEdit($matchId: ID!) {
    rejectLineupEdit(matchId: $matchId) {
      id
      lineupEditRequestedAt
    }
  }
`);

export const TeamRosterQuery = graphql(/* GraphQL */ `
  query TeamRoster($id: ID!) {
    teamById(id: $id) {
      id
      members {
        id
        user {
          id
          name
          username
          avatarUrl
          nationality
        }
      }
    }
  }
`);

export const MarkFrameWalkoverMutation = graphql(/* GraphQL */ `
  mutation MarkFrameWalkover(
    $matchId: ID!
    $frameNumber: Int!
    $homeWon: Boolean!
  ) {
    markFrameWalkover(
      matchId: $matchId
      frameNumber: $frameNumber
      homeWon: $homeWon
    ) {
      id
      frameNumber
      homeWon
      isWalkover
    }
  }
`);

export const ForfeitMatchMutation = graphql(/* GraphQL */ `
  mutation ForfeitMatch(
    $matchId: ID!
    $forfeitingTeamId: ID!
    $bothForfeit: Boolean
    $reason: String
  ) {
    forfeitMatch(
      matchId: $matchId
      forfeitingTeamId: $forfeitingTeamId
      bothForfeit: $bothForfeit
      reason: $reason
    ) {
      id
      status
      winType
      homeScore
      awayScore
      forfeitTeamId
    }
  }
`);

export const UpdateMatchScheduleMutation = graphql(/* GraphQL */ `
  mutation UpdateMatchSchedule(
    $id: ID!
    $scheduledAt: DateTime
    $venueId: ID
  ) {
    updateMatchSchedule(id: $id, scheduledAt: $scheduledAt, venueId: $venueId) {
      id
      scheduledAt
      venue {
        id
        name
      }
    }
  }
`);

export const RequestMatchRescheduleMutation = graphql(/* GraphQL */ `
  mutation RequestMatchReschedule(
    $matchId: ID!
    $proposedDate: DateTime!
    $reason: String
  ) {
    requestMatchReschedule(
      matchId: $matchId
      proposedDate: $proposedDate
      reason: $reason
    ) {
      id
      status
      proposedDate
    }
  }
`);

export const ReviewRescheduleRequestMutation = graphql(/* GraphQL */ `
  mutation ReviewRescheduleRequest($id: ID!, $approve: Boolean!) {
    reviewRescheduleRequest(id: $id, approve: $approve) {
      id
      status
    }
  }
`);

export const MatchRescheduleRequestsQuery = graphql(/* GraphQL */ `
  query MatchRescheduleRequests($matchId: ID!) {
    match(id: $matchId) {
      id
      rescheduleRequests {
        id
        status
        proposedDate
        reason
        createdAt
        requestedBy {
          id
          name
          username
        }
        reviewedBy {
          id
          name
        }
        reviewedAt
      }
    }
  }
`);

export const RecordFrameMutation = graphql(/* GraphQL */ `
  mutation RecordFrame($input: RecordFrameInput!) {
    recordMatchFrame(input: $input) {
      id
      frameNumber
      homeWon
      homePlayer
      awayPlayer
    }
  }
`);

export const SubmitMatchResultMutation = graphql(/* GraphQL */ `
  mutation SubmitMatchResult($input: SubmitMatchResultInput!) {
    submitMatchResult(input: $input) {
      id
      status
      homeScore
      awayScore
      completedAt
    }
  }
`);
