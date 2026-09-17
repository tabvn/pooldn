import { graphql } from "@/lib/graphql/generated";

export const CompetitionsListQuery = graphql(/* GraphQL */ `
  query CompetitionsList($filters: CompetitionFilters) {
    competitions(filters: $filters) {
      id
      slug
      name
      status
      type
      format
      gameType
      bannerUrl
      startDate
      endDate
      prizePool
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
      fixedMatchDates
      maxGamesPerVenuePerMatchday
      registrationLocked
      rosterLocked
      pointsWin
      pointsDraw
      pointsLoss
      organizer {
        id
        name
        username
        avatarUrl
        nationality
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
      raceToFrames
      minTeams
      maxTeams
      minPlayersPerTeam
      maxPlayersPerTeam
      requiresHomeVenue
      gamesPerOpponent
      matchVenueMode
      applicationMode
      viewerCanApply
      # Round-92 — the tab reads "Matches" for Free Schedule competitions, and
      # the tab's page branches on this too.
      schedulingType
      pendingReviewCount
      approvedTeamCount
      # Round-88 — placeholder players in this competition, and the claims on
      # them waiting for the organizer. Both drive the manager-only Claims tab.
      shellPlayerCount
      pendingClaimCount
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
      name
      status
      allMatchesPlayed
      prizePool
      minTeams
      maxTeams
      # Round-48 — overview "About this competition" card needs the apply-
      # relevant config visible BEFORE captains/players hit the apply form.
      type
      format
      gameType
      startDate
      endDate
      raceToFrames
      minPlayersPerTeam
      maxPlayersPerTeam
      breakAndRunRule
      requiresHomeVenue
      applicationMode
      registrationLocked
      rosterLocked
      matchVenueMode
      gamesPerOpponent
      weekdaySchedule {
        weekday
        time
      }
      rulesUrl
      organizer {
        id
      }
      city {
        id
        name
      }
      applications {
        id
        status
        team {
          id
          slug
          name
          logoUrl
          # Round-88 — a placeholder team, entered by the organizer so the
          # competition can run alongside its real teams.
          isShell
          shellMemberCount
          captain {
            id
            name
            username
            nationality
          }
          members {
            id
          }
        }
        # Round-76 — Singles entrants have no team; the invite banner matches
        # on the applicant instead.
        applicant {
          id
          isShell
          name
          username
          avatarUrl
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
        form
        team {
          id
          name
          slug
          logoUrl
          isShell
        }
      }
      bracketMatches {
        id
        bracketRound
        bracketPosition
        status
        homeScore
        awayScore
        winType
        homeTeam {
          id
          name
          slug
          logoUrl
        }
        awayTeam {
          id
          name
          slug
          logoUrl
        }
        homePlayer {
          id
          name
          username
          avatarUrl
        }
        awayPlayer {
          id
          name
          username
          avatarUrl
        }
      }
      playerStandings {
        position
        userId
        name
        username
        avatarUrl
        nationality
        played
        won
        lost
        framesFor
        framesAgainst
        points
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

export const CompetitionBracketQuery = graphql(/* GraphQL */ `
  query CompetitionBracket($slug: String!) {
    competition(slug: $slug) {
      id
      name
      format
      status
      bracketMatches {
        id
        bracketRound
        bracketPosition
        status
        homeScore
        awayScore
        winType
        homeTeam {
          id
          name
          slug
          logoUrl
        }
        awayTeam {
          id
          name
          slug
          logoUrl
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
        note
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
            logoUrl
          }
          awayTeam {
            id
            name
            slug
            logoUrl
          }
          homePlayer {
            id
            name
            username
            avatarUrl
          }
          awayPlayer {
            id
            name
            username
            avatarUrl
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
      name
      status
      organizer {
        id
      }
      mvpPtAppearance
      mvpPtSinglesWon
      mvpPtDoublesWon
      mvpPtBreakRun
      mvpMinAppearancePct
      rosters {
        id
        user {
          id
          name
          username
          nationality
          avatarUrl
          # Round-88 — placeholder players sit in the same table as real ones,
          # so the row has to say which it is.
          isShell
        }
        team {
          id
          name
          slug
          logoUrl
          isShell
        }
        stat {
          id
          matchesPlayed
          appearanceMatchdays
          teamMatchdays
          framesWon
          framesPlayed
          singlesPlayed
          singlesWon
          doublesPlayed
          doublesWon
          brWon
          mvpScore
          isMvp
        }
      }
    }
  }
`);

export const UpdateMvpConfigMutation = graphql(/* GraphQL */ `
  mutation UpdateMvpConfig($id: ID!, $input: UpdateMvpConfigInput!) {
    updateMvpConfig(id: $id, input: $input) {
      id
      mvpPtAppearance
      mvpPtSinglesWon
      mvpPtDoublesWon
      mvpPtBreakRun
      mvpMinAppearancePct
    }
  }
`);

export const CompetitionApplicationsQuery = graphql(/* GraphQL */ `
  query CompetitionApplications($slug: String!) {
    competition(slug: $slug) {
      id
      name
      type
      maxTeams
      applicationMode
      organizer {
        id
        name
      }
      applications {
        id
        status
        message
        # Round-77 — badge the Messages button without opening every thread.
        # The badge counts UNREAD; messageCount is the total.
        messageCount
        unreadMessageCount
        submittedAt
        reviewedAt
        # Round-93 — how much history a removal would destroy.
        matchCount
        playedMatchCount
        team {
          id
          name
          slug
          logoUrl
          isShell
          shellMemberCount
          captain {
            id
            name
            username
            nationality
          }
          homeVenue {
            id
            name
          }
          members {
            id
          }
        }
        rosterCaptain {
          id
          name
          username
          nationality
        }
        applicationPlayers {
          id
        }
        applicant {
          id
          isShell
          name
          username
          avatarUrl
          nationality
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
      type
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

// Round-50 — Application (players) detail page. Returns the locked roster,
// any pending RosterChangeRequest with its proposed players, plus the
// captain's team-member roster so the captain can pick from in the edit UI.
export const CompetitionApplicationDetailQuery = graphql(/* GraphQL */ `
  query CompetitionApplicationDetail($id: ID!) {
    competitionApplication(id: $id) {
      id
      status
      message
      reviewNote
      submittedAt
      reviewedAt
      competition {
        id
        slug
        name
        status
        registrationLocked
        rosterLocked
        minPlayersPerTeam
        maxPlayersPerTeam
        organizer {
          id
        }
      }
      team {
        id
        name
        slug
        logoUrl
        captain {
          id
          name
          username
          nationality
        }
        members {
          id
          isActive
          user {
            id
            name
            username
            nationality
            avatarUrl
          }
        }
      }
      rosterCaptain {
        id
        name
        username
        nationality
      }
      applicationPlayers {
        id
        name
        user {
          id
          name
          username
          nationality
          avatarUrl
        }
      }
      rosterChangeRequests {
        id
        status
        message
        reviewNote
        submittedAt
        reviewedAt
        requestedBy {
          id
          name
          username
        }
        reviewedBy {
          id
          name
          username
        }
        proposedPlayers {
          id
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

// Round-92 — Free Schedule: one flat list instead of a matchday calendar.
export const CompetitionMatchesQuery = graphql(/* GraphQL */ `
  query CompetitionMatches($slug: String!) {
    competition(slug: $slug) {
      id
      name
      type
      schedulingType
      matches {
        id
        status
        scheduledAt
        completedAt
        homeScore
        awayScore
        matchday {
          id
          number
        }
        venue {
          id
          name
        }
        homeTeam {
          id
          name
          slug
          logoUrl
        }
        awayTeam {
          id
          name
          slug
          logoUrl
        }
        homePlayer {
          id
          name
          username
          avatarUrl
          isShell
        }
        awayPlayer {
          id
          name
          username
          avatarUrl
          isShell
        }
      }
    }
  }
`);
