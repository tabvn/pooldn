import { graphql } from "@/lib/graphql/generated";

// Round-75 — admin league-import tooling operations.

export const AdminCompetitionsQuery = graphql(/* GraphQL */ `
  query AdminCompetitions {
    competitions {
      id
      name
      slug
      type
      format
      status
    }
  }
`);

export const CreateShellPlayersMutation = graphql(/* GraphQL */ `
  mutation CreateShellPlayers($input: CreateShellPlayersInput!) {
    createShellPlayers(input: $input) {
      userId
      name
      username
      claimUrl
    }
  }
`);

export const ImportLeagueTeamMutation = graphql(/* GraphQL */ `
  mutation ImportLeagueTeam($input: ImportLeagueTeamInput!) {
    importLeagueTeam(input: $input) {
      teamId
      teamSlug
      claims {
        userId
        name
        username
        claimUrl
      }
    }
  }
`);
