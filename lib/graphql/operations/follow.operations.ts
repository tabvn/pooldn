import { graphql } from "@/lib/graphql/generated";

export const FollowEntityMutation = graphql(/* GraphQL */ `
  mutation FollowEntity($entityType: FollowEntityType!, $entityId: ID!) {
    followEntity(entityType: $entityType, entityId: $entityId) {
      id
      entityType
      entityId
    }
  }
`);

export const UnfollowEntityMutation = graphql(/* GraphQL */ `
  mutation UnfollowEntity($entityType: FollowEntityType!, $entityId: ID!) {
    unfollowEntity(entityType: $entityType, entityId: $entityId)
  }
`);

export const FollowersQuery = graphql(/* GraphQL */ `
  query Followers(
    $entityType: FollowEntityType!
    $entityId: ID!
    $first: Int
    $after: String
  ) {
    followers(
      entityType: $entityType
      entityId: $entityId
      first: $first
      after: $after
    ) {
      id
      name
      username
      avatarUrl
      nationality
    }
    followerCountFor(entityType: $entityType, entityId: $entityId)
  }
`);
