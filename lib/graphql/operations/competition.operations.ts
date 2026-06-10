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
      rulesUrl
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
      requiresHomeVenue
      applicationMode
      invitedTeamIds
      matchVenueMode
      centralVenue {
        id
        slug
        name
      }
      gamesPerOpponent
      weekdaySchedule {
        weekday
        time
      }
      maxGamesPerVenuePerMatchday
      pointsWin
      pointsDraw
      pointsLoss
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
      requiresHomeVenue
      isFollowing
      followerCount
      myTeamApplication {
        id
        status
        team {
          id
          name
          slug
        }
      }
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
      prizePool
      currency
      minTeams
      maxTeams
      applications {
        id
        status
        team {
          id
          slug
          name
          logoUrl
          captain {
            id
            name
            username
          }
          members {
            id
          }
        }
      }
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
        singlesWon
        doublesWon
        brWon
        mvpScore
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
        singlesWon
        doublesWon
        brWon
        mvpScore
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
          logoUrl
          captain {
            id
            name
            username
          }
        }
      }
    }
  }
`);

export const MyCompetitionsQuery = graphql(/* GraphQL */ `
  query MyCompetitions {
    myCompetitions {
      id
      slug
      name
      status
      bannerUrl
      startDate
      endDate
      gameType
      format
      city {
        id
        name
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
