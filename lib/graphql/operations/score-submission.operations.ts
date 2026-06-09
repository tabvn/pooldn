import { graphql } from "@/lib/graphql/generated";

export const SubmitMatchScoreMutation = graphql(/* GraphQL */ `
  mutation SubmitMatchScore($input: SubmitMatchScoreInput!) {
    submitMatchScore(input: $input) {
      id
      status
      homeScore
      awayScore
      boardImageUrls
      submittedBy {
        id
        name
      }
    }
  }
`);

export const ReviewMatchScoreMutation = graphql(/* GraphQL */ `
  mutation ReviewMatchScore($input: ReviewMatchScoreInput!) {
    reviewMatchScore(input: $input) {
      id
      status
      homeScore
      awayScore
    }
  }
`);

export const MatchScoreSubmissionsForMatchQuery = graphql(/* GraphQL */ `
  query MatchScoreSubmissionsForMatch($matchId: ID!) {
    matchScoreSubmissionsForMatch(matchId: $matchId) {
      id
      homeScore
      awayScore
      status
      note
      boardImageUrls
      createdAt
      reviewedAt
      submittedBy {
        id
        name
        username
      }
      reviewedBy {
        id
        name
      }
      forTeam {
        id
        name
      }
    }
  }
`);

export const MatchScoreSubmissionsListQuery = graphql(/* GraphQL */ `
  query MatchScoreSubmissionsList {
    matchScoreSubmissions {
      id
      homeScore
      awayScore
      status
      note
      createdAt
      reviewedAt
      submittedBy {
        id
        name
        username
      }
      reviewedBy {
        id
        name
      }
      forTeam {
        id
        name
      }
      match {
        id
        homeScore
        awayScore
        status
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
