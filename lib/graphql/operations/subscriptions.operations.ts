import { graphql } from "@/lib/graphql/generated";

export const MatchUpdatedSubscription = graphql(/* GraphQL */ `
  subscription MatchUpdated($id: ID!) {
    matchUpdated(id: $id) {
      id
      status
      homeScore
      awayScore
      completedAt
      completionMode
      winType
      completedBy {
        id
        name
        username
      }
      frames {
        id
        frameNumber
        homeWon
        homePlayer
        awayPlayer
      }
    }
  }
`);

export const NotificationReceivedSubscription = graphql(/* GraphQL */ `
  subscription NotificationReceived {
    notificationReceived {
      id
      type
      title
      message
      isRead
      entityType
      entityId
      entitySlug
      groupKey
      href
      createdAt
    }
  }
`);

export const CompetitionStandingsUpdatedSubscription = graphql(/* GraphQL */ `
  subscription CompetitionStandingsUpdated($competitionId: ID!) {
    competitionStandingsUpdated(competitionId: $competitionId) {
      id
      position
      played
      won
      drawn
      lost
      points
      pointsFor
      pointsAgainst
      pointDiff
      team {
        id
        name
        slug
        logoUrl
      }
    }
  }
`);
