import { graphql } from "@/lib/graphql/generated";

export const DashboardQuery = graphql(/* GraphQL */ `
  query Dashboard {
    viewer {
      id
      name
      username
      role
    }
    viewerTodayMatch {
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
      homeLineupSubmittedAt
      awayLineupSubmittedAt
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
      homeLineupSubmittedAt
      awayLineupSubmittedAt
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
      type
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
    active: competitions(filters: { status: ONGOING }) {
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
      currency
      minTeams
      maxTeams
      city {
        id
        name
      }
    }
    # Round-57 — organizer's in-progress DRAFTs surface as a
    # "Resume editing" rail at the top of the dashboard so the user
    # can pick up where they left off. Resolved by the existing
    # myCompetitions field; we filter to DRAFT in the page.
    myCompetitions {
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
      currency
      minTeams
      maxTeams
      updatedAt
      city {
        id
        name
      }
    }
  }
`);
