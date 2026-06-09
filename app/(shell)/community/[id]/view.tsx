"use client";

import type { ResultOf } from "@graphql-typed-document-node/core";
import { PostCard } from "../post-card";
import { CommunityPostByIdQuery } from "@/lib/graphql/operations/community.operations";

type Post = NonNullable<
  ResultOf<typeof CommunityPostByIdQuery>["communityPost"]
>;

export function PostPermalinkView({
  post,
  viewerId,
  isAdmin,
  highlightCommentId,
}: {
  post: Post;
  viewerId: string | null;
  isAdmin: boolean;
  highlightCommentId: string | null;
}) {
  // Reuse PostCard for visual consistency; pass defaultOpenComments=true and
  // the highlight target so the embedded thread auto-scrolls/highlights.
  return (
    <PostCard
      post={post}
      viewerId={viewerId}
      isAdmin={isAdmin}
      defaultOpenComments
      highlightCommentId={highlightCommentId ?? undefined}
    />
  );
}
