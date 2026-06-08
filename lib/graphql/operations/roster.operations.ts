import { graphql } from "@/lib/graphql/generated";

export const RosterConflictsQuery = graphql(/* GraphQL */ `
  query RosterConflicts($competitionId: ID!, $excludeTeamId: ID) {
    rosterConflicts(competitionId: $competitionId, excludeTeamId: $excludeTeamId) {
      userId
      userName
      userUsername
      teamId
      teamName
      status
    }
  }
`);
