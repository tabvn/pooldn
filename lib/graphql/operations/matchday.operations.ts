import { graphql } from "@/lib/graphql/generated";

export const GenerateMatchdaysMutation = graphql(/* GraphQL */ `
  mutation GenerateMatchdays($id: ID!, $maxGamesPerVenuePerMatchday: Int) {
    generateMatchdays(
      id: $id
      maxGamesPerVenuePerMatchday: $maxGamesPerVenuePerMatchday
    ) {
      id
      slug
    }
  }
`);

export const ShiftMatchdayMutation = graphql(/* GraphQL */ `
  mutation ShiftMatchday($matchdayId: ID!, $scheduledDate: DateTime!, $note: String) {
    shiftMatchdayOnward(
      matchdayId: $matchdayId
      scheduledDate: $scheduledDate
      note: $note
    ) {
      id
      number
      scheduledDate
      note
    }
  }
`);

export const PreviewMatchdaysQuery = graphql(/* GraphQL */ `
  query PreviewMatchdays($id: ID!, $maxGamesPerVenuePerMatchday: Int) {
    previewMatchdays(
      id: $id
      maxGamesPerVenuePerMatchday: $maxGamesPerVenuePerMatchday
    ) {
      number
      label
      scheduledDate
      byes {
        teamId
        teamName
        teamLogoUrl
      }
      matches {
        homeTeamId
        homeTeamName
        homeTeamLogoUrl
        awayTeamId
        awayTeamName
        awayTeamLogoUrl
        venueId
        venueName
        swapped
      }
    }
  }
`);
