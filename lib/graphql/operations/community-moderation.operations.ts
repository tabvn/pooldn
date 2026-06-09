import { graphql } from "@/lib/graphql/generated";

export const ReportCommunityMutation = graphql(/* GraphQL */ `
  mutation ReportCommunity(
    $targetType: CommunityReportTarget!
    $targetId: ID!
    $reason: String!
  ) {
    reportCommunity(
      targetType: $targetType
      targetId: $targetId
      reason: $reason
    ) {
      id
      status
    }
  }
`);

export const BlockUserMutation = graphql(/* GraphQL */ `
  mutation BlockUser($userId: ID!, $block: Boolean!) {
    blockUser(userId: $userId, block: $block)
  }
`);

export const HideCommunityPostMutation = graphql(/* GraphQL */ `
  mutation HideCommunityPost($id: ID!, $hide: Boolean!, $reason: String) {
    hideCommunityPost(id: $id, hide: $hide, reason: $reason) {
      id
      isHidden
      hiddenReason
    }
  }
`);

export const HideCommunityCommentMutation = graphql(/* GraphQL */ `
  mutation HideCommunityComment(
    $id: ID!
    $hide: Boolean!
    $reason: String
  ) {
    hideCommunityComment(id: $id, hide: $hide, reason: $reason) {
      id
    }
  }
`);

export const PinCommunityPostMutation = graphql(/* GraphQL */ `
  mutation PinCommunityPost($id: ID!, $pin: Boolean!) {
    pinCommunityPost(id: $id, pin: $pin) {
      id
      pinnedAt
    }
  }
`);

export const CommunityReportsQuery = graphql(/* GraphQL */ `
  query CommunityReports($status: CommunityReportStatus, $first: Int, $after: ID) {
    communityReports(status: $status, first: $first, after: $after) {
      id
      targetType
      targetId
      targetPostId
      reason
      status
      createdAt
      reporter {
        id
        name
        username
        avatarUrl
      }
      reviewedBy {
        id
        name
      }
      reviewedAt
    }
  }
`);

export const ResolveCommunityReportMutation = graphql(/* GraphQL */ `
  mutation ResolveCommunityReport(
    $id: ID!
    $status: CommunityReportStatus!
  ) {
    resolveCommunityReport(id: $id, status: $status) {
      id
      status
      reviewedAt
    }
  }
`);

export const MyBlockedUsersQuery = graphql(/* GraphQL */ `
  query MyBlockedUsers {
    myBlockedUsers {
      id
      name
      username
      avatarUrl
    }
  }
`);
