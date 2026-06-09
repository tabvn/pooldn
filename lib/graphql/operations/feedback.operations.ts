import { graphql } from "@/lib/graphql/generated";

export const CreateFeedbackMutation = graphql(/* GraphQL */ `
  mutation CreateFeedback(
    $type: FeedbackType
    $subject: String!
    $message: String!
    $contactEmail: String
  ) {
    createFeedback(
      type: $type
      subject: $subject
      message: $message
      contactEmail: $contactEmail
    ) {
      id
      status
    }
  }
`);

export const FeedbackInboxQuery = graphql(/* GraphQL */ `
  query FeedbackInbox(
    $status: FeedbackStatus
    $type: FeedbackType
    $first: Int
    $after: String
  ) {
    feedbackInbox(
      status: $status
      type: $type
      first: $first
      after: $after
    ) {
      id
      subject
      type
      status
      createdAt
      user {
        id
        name
        username
        avatarUrl
      }
      contactEmail
    }
    feedbackUnreadCount
  }
`);

export const FeedbackDetailQuery = graphql(/* GraphQL */ `
  query FeedbackDetail($id: ID!) {
    feedbackById(id: $id) {
      id
      subject
      message
      type
      status
      adminNote
      contactEmail
      createdAt
      updatedAt
      resolvedAt
      user {
        id
        name
        username
        email
        avatarUrl
      }
      resolvedBy {
        id
        name
        username
      }
    }
  }
`);

export const DeleteFeedbackMutation = graphql(/* GraphQL */ `
  mutation DeleteFeedback($id: ID!) {
    deleteFeedback(id: $id)
  }
`);

export const UpdateFeedbackStatusMutation = graphql(/* GraphQL */ `
  mutation UpdateFeedbackStatus(
    $id: ID!
    $status: FeedbackStatus!
    $adminNote: String
  ) {
    updateFeedbackStatus(
      id: $id
      status: $status
      adminNote: $adminNote
    ) {
      id
      status
      adminNote
      resolvedAt
      resolvedBy {
        id
        name
      }
    }
  }
`);
