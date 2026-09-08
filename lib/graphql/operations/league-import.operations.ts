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

// Round-85 — admin roster of everything the import created.
export const ShellPlayersQuery = graphql(/* GraphQL */ `
  query ShellPlayers($status: String, $search: String, $first: Int, $after: ID) {
    shellPlayers(
      status: $status
      search: $search
      first: $first
      after: $after
    ) {
      id
      name
      username
      avatarUrl
      nationality
      isShell
      claimedAt
      createdAt
      city {
        id
        name
      }
    }
  }
`);

export const ShellTeamsQuery = graphql(/* GraphQL */ `
  query ShellTeams($search: String) {
    shellTeams(search: $search) {
      id
      name
      slug
      logoUrl
      cityName
      memberCount
      shellCount
      claimedCount
      createdAt
    }
  }
`);

export const ReissueClaimLinkMutation = graphql(/* GraphQL */ `
  mutation ReissueClaimLink($userId: ID!) {
    reissueClaimLink(userId: $userId) {
      userId
      name
      username
      claimUrl
    }
  }
`);

// Round-86 — remove a mistaken shell, or fold one into a real account.
export const DeleteShellPlayerMutation = graphql(/* GraphQL */ `
  mutation DeleteShellPlayer($userId: ID!) {
    deleteShellPlayer(userId: $userId)
  }
`);

export const MergeShellIntoPlayerMutation = graphql(/* GraphQL */ `
  mutation MergeShellIntoPlayer($shellUserId: ID!, $targetUserId: ID!) {
    mergeShellIntoPlayer(
      shellUserId: $shellUserId
      targetUserId: $targetUserId
    ) {
      teamsMoved
      rostersMoved
      applicationsMoved
      framesMoved
      matchesMoved
      statsMerged
    }
  }
`);

export const MergeClaimIntoMyAccountMutation = graphql(/* GraphQL */ `
  mutation MergeClaimIntoMyAccount($token: String!) {
    mergeClaimIntoMyAccount(token: $token) {
      teamsMoved
      rostersMoved
      applicationsMoved
      framesMoved
      matchesMoved
      statsMerged
    }
  }
`);

// Round-88 — organizer-side placeholder management, scoped to one competition.

export const AddShellPlayerMutation = graphql(/* GraphQL */ `
  mutation AddShellPlayer($competitionId: ID!, $name: String!, $teamId: ID) {
    addShellPlayer(
      competitionId: $competitionId
      name: $name
      teamId: $teamId
    ) {
      userId
      name
      username
      claimUrl
    }
  }
`);

export const RemoveShellPlayerFromCompetitionMutation = graphql(/* GraphQL */ `
  mutation RemoveShellPlayerFromCompetition($competitionId: ID!, $userId: ID!) {
    removeShellPlayerFromCompetition(
      competitionId: $competitionId
      userId: $userId
    )
  }
`);
