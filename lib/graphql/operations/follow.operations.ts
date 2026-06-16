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

// Round-50 — users a player follows. Pairs with the `following` resolver,
// powers the /players/[username]/following page + a count chip on the
// profile.
export const FollowingQuery = graphql(/* GraphQL */ `
  query Following($userId: ID!, $first: Int, $after: String) {
    following(userId: $userId, first: $first, after: $after) {
      id
      name
      username
      avatarUrl
      nationality
    }
  }
`);

export const FollowedTeamsQuery = graphql(/* GraphQL */ `
  query FollowedTeams($userId: ID!, $first: Int, $after: String) {
    followedTeams(userId: $userId, first: $first, after: $after) {
      id
      slug
      name
      logoUrl
      captain {
        id
        name
        username
        nationality
      }
      members {
        id
      }
    }
  }
`);

export const FollowedCompetitionsQuery = graphql(/* GraphQL */ `
  query FollowedCompetitions($userId: ID!, $first: Int, $after: String) {
    followedCompetitions(userId: $userId, first: $first, after: $after) {
      id
      slug
      name
      bannerUrl
      status
      gameType
      startDate
      endDate
      city {
        id
        name
      }
    }
  }
`);
