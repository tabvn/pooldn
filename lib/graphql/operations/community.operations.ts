import { graphql } from "@/lib/graphql/generated";

export const CommunityFeedQuery = graphql(/* GraphQL */ `
  query CommunityFeed(
    $cityId: ID
    $tag: String
    $authorId: ID
    $first: Int
    $after: ID
  ) {
    communityPosts(
      cityId: $cityId
      tag: $tag
      authorId: $authorId
      first: $first
      after: $after
    ) {
      ...PostCardFields
    }
  }

  fragment PostCardFields on CommunityPost {
    id
    body
    createdAt
    tags
    imageUrls
    isHidden
    hiddenReason
    pinnedAt
    commentCount
    reactionTotal
    quoteCount
    reactionCounts {
      type
      count
    }
    viewerReactions
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
    quotedPost {
      id
      body
      imageUrls
      createdAt
      author {
        id
        name
        username
        avatarUrl
      }
    }
  }
`);

export const TrendingCommunityPostsQuery = graphql(/* GraphQL */ `
  query TrendingCommunityPosts($limit: Int) {
    trendingCommunityPosts(limit: $limit) {
      ...PostCardFields
    }
  }
`);

export const CreatePostMutation = graphql(/* GraphQL */ `
  mutation CreatePost($input: CreatePostInput!) {
    createCommunityPost(input: $input) {
      ...PostCardFields
    }
  }
`);

export const UpdateCommunityPostMutation = graphql(/* GraphQL */ `
  mutation UpdateCommunityPost($id: ID!, $body: String!) {
    updateCommunityPost(id: $id, body: $body) {
      id
      body
      tags
    }
  }
`);

export const DeleteCommunityPostMutation = graphql(/* GraphQL */ `
  mutation DeleteCommunityPost($id: ID!) {
    deleteCommunityPost(id: $id)
  }
`);

export const ToggleCommunityReactionMutation = graphql(/* GraphQL */ `
  mutation ToggleCommunityReaction(
    $postId: ID!
    $type: CommunityReactionType!
  ) {
    toggleCommunityReaction(postId: $postId, type: $type) {
      id
      reactionTotal
      reactionCounts {
        type
        count
      }
      viewerReactions
    }
  }
`);

export const CommunityPostByIdQuery = graphql(/* GraphQL */ `
  query CommunityPostById($id: ID!) {
    communityPost(id: $id) {
      ...PostCardFields
      comments {
        id
        body
        createdAt
        editedAt
        parentId
        author {
          id
          name
          username
          avatarUrl
        }
      }
    }
  }
`);

export const CommunityCommentsQuery = graphql(/* GraphQL */ `
  query CommunityComments($postId: ID!) {
    communityPost(id: $postId) {
      id
      comments {
        id
        body
        createdAt
        editedAt
        parentId
        author {
          id
          name
          username
          avatarUrl
        }
      }
    }
  }
`);

export const CreateCommunityCommentMutation = graphql(/* GraphQL */ `
  mutation CreateCommunityComment(
    $postId: ID!
    $parentId: ID
    $body: String!
  ) {
    createCommunityComment(postId: $postId, parentId: $parentId, body: $body) {
      id
      body
      createdAt
      parentId
      author {
        id
        name
        username
        avatarUrl
      }
    }
  }
`);

export const UpdateCommunityCommentMutation = graphql(/* GraphQL */ `
  mutation UpdateCommunityComment($id: ID!, $body: String!) {
    updateCommunityComment(id: $id, body: $body) {
      id
      body
      editedAt
    }
  }
`);

export const DeleteCommunityCommentMutation = graphql(/* GraphQL */ `
  mutation DeleteCommunityComment($id: ID!) {
    deleteCommunityComment(id: $id)
  }
`);

// Community "Players" tab — players in the active city (location-scoped
// directory). Ordered newest-first by the resolver.
export const CityPlayersQuery = graphql(/* GraphQL */ `
  query CityPlayers($cityId: ID, $first: Int) {
    users(cityId: $cityId, first: $first) {
      id
      name
      username
      avatarUrl
      nationality
      role
      city {
        id
        name
      }
    }
  }
`);
