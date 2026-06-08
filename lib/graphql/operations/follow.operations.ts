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
