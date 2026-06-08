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
      homeTeam {
        id
        name
        captain {
          id
        }
      }
      awayTeam {
        id
        name
        captain {
          id
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
          raceToFrames
          breakAndRunRule
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
      homeLineupSubmittedAt
      awayLineupSubmittedAt
      bothLineupsSubmitted
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
