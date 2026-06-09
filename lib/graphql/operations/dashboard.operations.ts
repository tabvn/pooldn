import { graphql } from "@/lib/graphql/generated";

export const DashboardQuery = graphql(/* GraphQL */ `
  query Dashboard {
    viewer {
      id
      name
      username
      role
    }
    viewerNextMatch {
      id
      status
      scheduledAt
      homeScore
      awayScore
      homeTeam {
        id
        name
        logoUrl
      }
      awayTeam {
        id
        name
        logoUrl
      }
      venue {
        id
        name
      }
      matchday {
        id
        number
        competition {
          id
          name
          slug
          bannerUrl
        }
      }
    }
    upcoming: competitions(
      filters: { status: OPEN_FOR_APPLICATIONS }
    ) {
      id
      slug
      name
      status
      format
      gameType
      bannerUrl
      startDate
      endDate
      prizePool
      currency
      minTeams
      maxTeams
      city {
        id
        name
      }
    }
    myFollows {
      id
      entityType
      entityId
      createdAt
    }
    myFollowedCompetitions {
      id
      slug
      name
      status
      format
      gameType
      bannerUrl
      startDate
      endDate
      prizePool
      currency
      minTeams
      maxTeams
      city {
        id
        name
      }
    }
    myFollowedTeams {
      id
      slug
      name
      logoUrl
      followerCount
      members {
        id
      }
      captain {
        id
        name
        username
      }
    }
    active: competitions(filters: { status: ONGOING }) {
      id
      slug
      name
      status
      format
      gameType
      bannerUrl
      startDate
      endDate
      prizePool
      currency
      minTeams
      maxTeams
      city {
        id
        name
      }
    }
  }
`);
