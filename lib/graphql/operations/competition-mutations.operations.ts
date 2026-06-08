import { graphql } from "@/lib/graphql/generated";

export const CreateCompetitionMutation = graphql(/* GraphQL */ `
  mutation CreateCompetition($input: CreateCompetitionInput!) {
    createCompetition(input: $input) {
      id
      slug
      name
      status
    }
  }
`);

export const PublishCompetitionMutation = graphql(/* GraphQL */ `
  mutation PublishCompetition($id: ID!) {
    publishCompetition(id: $id) {
      id
      status
    }
  }
`);

export const CloseApplicationsMutation = graphql(/* GraphQL */ `
  mutation CloseApplications($id: ID!) {
    closeApplications(id: $id) {
      id
      status
    }
  }
`);

export const StartCompetitionMutation = graphql(/* GraphQL */ `
  mutation StartCompetition($id: ID!) {
    startCompetition(id: $id) {
      id
      status
    }
  }
`);

export const CompleteCompetitionMutation = graphql(/* GraphQL */ `
  mutation CompleteCompetition($id: ID!) {
    completeCompetition(id: $id) {
      id
      status
    }
  }
`);

export const CancelCompetitionMutation = graphql(/* GraphQL */ `
  mutation CancelCompetition($id: ID!) {
    cancelCompetition(id: $id) {
      id
      status
    }
  }
`);

export const UpdateCompetitionMutation = graphql(/* GraphQL */ `
  mutation UpdateCompetition($id: ID!, $input: UpdateCompetitionInput!) {
    updateCompetition(id: $id, input: $input) {
      id
      slug
      name
      status
      bannerUrl
      description
    }
  }
`);

export const DeleteCompetitionMutation = graphql(/* GraphQL */ `
  mutation DeleteCompetition($id: ID!) {
    deleteCompetition(id: $id)
  }
`);

export const ApplyToCompetitionMutation = graphql(/* GraphQL */ `
  mutation ApplyToCompetition($input: ApplyToCompetitionInput!) {
    applyToCompetition(input: $input) {
      id
      status
      team {
        id
        name
      }
    }
  }
`);

export const ReviewApplicationMutation = graphql(/* GraphQL */ `
  mutation ReviewApplication($input: ReviewApplicationInput!) {
    reviewApplication(input: $input) {
      id
      status
      reviewNote
      reviewedAt
    }
  }
`);

export const WithdrawApplicationMutation = graphql(/* GraphQL */ `
  mutation WithdrawApplication($id: ID!) {
    withdrawApplication(id: $id) {
      id
      status
    }
  }
`);

export const EditApplicationRosterMutation = graphql(/* GraphQL */ `
  mutation EditApplicationRoster($id: ID!, $playerUserIds: [ID!]!) {
    editApplicationRoster(id: $id, playerUserIds: $playerUserIds) {
      id
      applicationPlayers {
        id
        user {
          id
          name
        }
      }
    }
  }
`);
