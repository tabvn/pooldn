import { graphql } from "@/lib/graphql/generated";

export const CompetitionsListQuery = graphql(/* GraphQL */ `
  query CompetitionsList($filters: CompetitionFilters) {
    competitions(filters: $filters) {
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
      city {
        id
        name
      }
    }
  }
`);

export const CompetitionEditableQuery = graphql(/* GraphQL */ `
  query CompetitionEditable($slug: String!) {
    competition(slug: $slug) {
      id
      slug
      name
      description
      status
      format
      gameType
      type
      bannerUrl
      schedulingType
      startDate
      endDate
      prizePool
      currency
      raceToFrames
      minTeams
      maxTeams
      minPlayersPerTeam
      maxPlayersPerTeam
      breakAndRunRule
      organizer {
        id
        name
        username
        avatarUrl
      }
      city {
        id
        name
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
`);

export const CompetitionHeaderQuery = graphql(/* GraphQL */ `
  query CompetitionHeader($slug: String!) {
    competition(slug: $slug) {
      id
      slug
      name
      description
      status
      format
      gameType
      type
      bannerUrl
      startDate
      endDate
      prizePool
      currency
      raceToFrames
      minTeams
      maxTeams
      minPlayersPerTeam
      maxPlayersPerTeam
      isFollowing
      followerCount
      organizer {
        id
        name
        username
        avatarUrl
      }
      city {
        id
        name
      }
    }
  }
`);

export const CompetitionOverviewQuery = graphql(/* GraphQL */ `
  query CompetitionOverview($slug: String!) {
    competition(slug: $slug) {
      id
      status
      standings {
        id
        position
        played
        won
        drawn
        lost
        pointsFor
        pointsAgainst
        pointDiff
        points
        team {
          id
          name
          slug
          logoUrl
        }
      }
      playerStats {
        id
        isMvp
        matchesPlayed
        framesWon
        framesPlayed
        user {
          id
          name
          nationality
          avatarUrl
        }
      }
    }
  }
`);

export const CompetitionMatchdaysQuery = graphql(/* GraphQL */ `
  query CompetitionMatchdays($slug: String!) {
    competition(slug: $slug) {
      id
      matchdays {
        id
        number
        label
        scheduledDate
        matches {
          id
          status
          scheduledAt
          homeScore
          awayScore
          homeTeam {
            id
            name
            slug
          }
          awayTeam {
            id
            name
            slug
          }
          venue {
            id
            name
          }
        }
      }
    }
  }
`);

export const CompetitionPlayersQuery = graphql(/* GraphQL */ `
  query CompetitionPlayers($slug: String!) {
    competition(slug: $slug) {
      id
      playerStats {
        id
        matchesPlayed
        framesWon
        framesPlayed
        isMvp
        user {
          id
          name
          username
          nationality
          avatarUrl
        }
      }
    }
  }
`);

export const CompetitionApplicationsQuery = graphql(/* GraphQL */ `
  query CompetitionApplications($slug: String!) {
    competition(slug: $slug) {
      id
      applications {
        id
        status
        message
        submittedAt
        reviewedAt
        team {
          id
          name
          slug
          captain {
            id
            name
          }
        }
      }
    }
  }
`);

export const CitiesQuery = graphql(/* GraphQL */ `
  query Cities {
    cities {
      id
      name
      country {
        id
        name
        code
      }
    }
  }
`);

export const ViewerQuery = graphql(/* GraphQL */ `
  query Viewer {
    viewer {
      id
      name
      username
      role
      avatarUrl
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
