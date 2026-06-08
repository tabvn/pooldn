import { graphql } from "@/lib/graphql/generated";

export const NotificationsConnectionQuery = graphql(/* GraphQL */ `
  query NotificationsConnection($first: Int, $after: ID, $onlyUnread: Boolean) {
    notifications(first: $first, after: $after, onlyUnread: $onlyUnread) {
      nodes {
        id
        type
        title
        message
        isRead
        entityType
        entityId
        entitySlug
        groupKey
        href
        createdAt
      }
      nextCursor
    }
  }
`);

export const UnreadNotificationCountQuery = graphql(/* GraphQL */ `
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`);

export const MarkNotificationReadMutation = graphql(/* GraphQL */ `
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      isRead
    }
  }
`);

export const MarkAllNotificationsReadMutation = graphql(/* GraphQL */ `
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`);
