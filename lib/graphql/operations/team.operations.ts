import { graphql } from "@/lib/graphql/generated";

export const TeamsListQuery = graphql(/* GraphQL */ `
  query TeamsList($cityId: ID) {
    teams(cityId: $cityId) {
      id
      slug
      name
      logoUrl
      isActive
      captain {
        id
        name
        username
        nationality
      }
      homeVenue {
        id
        name
        city {
          id
          name
        }
      }
      members {
        id
      }
    }
  }
`);

export const MyTeamsQuery = graphql(/* GraphQL */ `
  query MyTeams {
    viewer {
      id
    }
    myTeams {
      id
      slug
      name
      logoUrl
      isActive
      captain {
        id
        name
        username
      }
      members {
        id
        user {
          id
        }
      }
    }
  }
`);

export const TeamDetailQuery = graphql(/* GraphQL */ `
  query TeamDetail($slug: String!) {
    team(slug: $slug) {
      id
      slug
      name
      logoUrl
      description
      isActive
      bannedAt
      banReason
      isFollowing
      followerCount
      createdAt
      myInvitation {
        id
        message
        createdAt
        invitedBy {
          id
          name
          username
        }
      }
      captain {
        id
        name
        username
        avatarUrl
        nationality
      }
      homeVenue {
        id
        slug
        name
        city {
          id
          name
        }
      }
      members {
        id
        joinedAt
        user {
          id
          name
          username
          avatarUrl
          nationality
        }
      }
      applications {
        id
        status
        submittedAt
        competition {
          id
          slug
          name
          status
          bannerUrl
        }
      }
      homeMatches {
        id
        status
        scheduledAt
        homeScore
        awayScore
        homeTeam {
          id
          name
        }
        awayTeam {
          id
          name
        }
        matchday {
          id
          number
          competition {
            id
            slug
            name
            bannerUrl
          }
        }
      }
      awayMatches {
        id
        status
        scheduledAt
        homeScore
        awayScore
        homeTeam {
          id
          name
        }
        awayTeam {
          id
          name
        }
        matchday {
          id
          number
          competition {
            id
            slug
            name
            bannerUrl
          }
        }
      }
    }
  }
`);
