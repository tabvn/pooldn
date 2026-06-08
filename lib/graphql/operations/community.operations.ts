import { graphql } from "@/lib/graphql/generated";

export const CommunityFeedQuery = graphql(/* GraphQL */ `
  query CommunityFeed($cityId: ID, $limit: Int) {
    communityPosts(cityId: $cityId, limit: $limit) {
      id
      body
      createdAt
      author {
        id
        name
        username
        avatarUrl
      }
      city {
        id
        name
      }
    }
  }
`);

export const CreatePostMutation = graphql(/* GraphQL */ `
  mutation CreatePost($input: CreatePostInput!) {
    createCommunityPost(input: $input) {
      id
      body
      createdAt
      author {
        id
        name
        username
      }
    }
  }
`);
