import { graphql } from "@/lib/graphql/generated";

export const MyNotificationPreferencesQuery = graphql(/* GraphQL */ `
  query MyNotificationPreferences {
    myNotificationPreferences {
      id
      type
      channel
      isEnabled
      updatedAt
    }
  }
`);

export const SetNotificationPreferenceMutation = graphql(/* GraphQL */ `
  mutation SetNotificationPreference(
    $type: String!
    $channel: NotificationChannel!
    $isEnabled: Boolean!
  ) {
    setNotificationPreference(
      type: $type
      channel: $channel
      isEnabled: $isEnabled
    ) {
      id
      type
      channel
      isEnabled
    }
  }
`);
