"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import type { ResultOf } from "@graphql-typed-document-node/core";
import {
  EyeOff,
  Flag,
  Link2,
  MessageCircle,
  Pencil,
  Pin,
  Quote,
  Reply,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useConfirm, usePrompt } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { CommunityImages } from "@/components/community/image-lightbox";
import { ReactionBar } from "@/components/community/reaction-bar";
import { CommunityRichText } from "@/components/community/rich-text";
import { QuoteCard } from "@/components/community/quote-card";
import {
  CommunityCommentsQuery,
  CommunityFeedQuery,
  CreateCommunityCommentMutation,
  DeleteCommunityCommentMutation,
  DeleteCommunityPostMutation,
  UpdateCommunityCommentMutation,
  UpdateCommunityPostMutation,
} from "@/lib/graphql/operations/community.operations";
import {
  BlockUserMutation,
  HideCommunityPostMutation,
  PinCommunityPostMutation,
  ReportCommunityMutation,
} from "@/lib/graphql/operations/community-moderation.operations";

type FeedPost = ResultOf<typeof CommunityFeedQuery>["communityPosts"][number];

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function PostCard({
  post,
  viewerId,
  isAdmin,
  defaultOpenComments = false,
  highlightCommentId,
  onQuote,
}: {
  post: FeedPost;
  viewerId: string | null;
  isAdmin: boolean;
  defaultOpenComments?: boolean;
  highlightCommentId?: string;
  onQuote?: (post: FeedPost) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const isAuthor = viewerId === post.author.id;

  const [showComments, setShowComments] = useState(defaultOpenComments);
  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(post.body);

  const [updatePost, { loading: savingEdit }] = useMutation(
    UpdateCommunityPostMutation,
  );
  const [deletePost] = useMutation(DeleteCommunityPostMutation, {
    refetchQueries: [
      {
        query: CommunityFeedQuery,
        variables: { first: 30 },
      },
    ],
  });
  const [reportPost] = useMutation(ReportCommunityMutation);
  const [blockUser] = useMutation(BlockUserMutation, {
    refetchQueries: [
      { query: CommunityFeedQuery, variables: { first: 30 } },
    ],
  });
  const [hidePost] = useMutation(HideCommunityPostMutation, {
    refetchQueries: [
      { query: CommunityFeedQuery, variables: { first: 30 } },
    ],
    awaitRefetchQueries: true,
  });
  const [pinPost] = useMutation(PinCommunityPostMutation, {
    refetchQueries: [
      { query: CommunityFeedQuery, variables: { first: 30 } },
    ],
    awaitRefetchQueries: true,
  });

  async function onReport() {
    if (!viewerId) {
      toast.error("Sign in to report");
      return;
    }
    const reason = await prompt({
      title: "Flag this post",
      description:
        "Tell the moderators what's wrong with this post. They'll review and follow up if needed.",
      inputLabel: "Reason",
      inputPlaceholder: "e.g. Off-topic spam, harassment of @user, …",
      confirmLabel: "Submit report",
      destructive: true,
      required: true,
    });
    if (reason === null) return;
    try {
      await reportPost({
        variables: {
          targetType: "POST",
          targetId: post.id,
          reason,
        },
      });
      toast.success("Reported", "Thanks — admins will take a look.");
    } catch (e) {
      toast.error("Could not report", e);
    }
  }

  async function onBlock() {
    if (!viewerId) return;
    const ok = await confirm({
      title: `Block ${post.author.name}?`,
      description:
        "You'll stop seeing their posts and comments. You can unblock later from settings.",
      confirmLabel: "Block",
      destructive: true,
    });
    if (!ok) return;
    try {
      await blockUser({
        variables: { userId: post.author.id, block: true },
      });
      toast.success("Blocked");
    } catch (e) {
      toast.error("Could not block", e);
    }
  }

  async function onToggleHide() {
    try {
      await hidePost({
        variables: { id: post.id, hide: !post.isHidden },
      });
      toast.success(post.isHidden ? "Post unhidden" : "Post hidden");
    } catch (e) {
      toast.error("Could not update visibility", e);
    }
  }

  async function onTogglePin() {
    try {
      await pinPost({
        variables: { id: post.id, pin: !post.pinnedAt },
      });
      toast.success(post.pinnedAt ? "Unpinned" : "Pinned");
    } catch (e) {
      toast.error("Could not pin", e);
    }
  }

  async function onSaveEdit() {
    const body = draftBody.trim();
    if (!body || body === post.body) {
      setEditing(false);
      return;
    }
    try {
      await updatePost({ variables: { id: post.id, body } });
      toast.success("Post updated");
      setEditing(false);
    } catch (e) {
      toast.error("Could not update", e);
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: "Delete this post?",
      description: "Comments and reactions are removed too.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePost({ variables: { id: post.id } });
      toast.success("Post deleted");
    } catch (e) {
      toast.error("Could not delete", e);
    }
  }

  async function copyLink() {
    const base =
      typeof window !== "undefined" ? window.location.origin : "";
    try {
      await navigator.clipboard.writeText(`${base}/community/${post.id}`);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <Card data-testid={`community-post-${post.id}`} id={`post-${post.id}`}>
      <CardContent className="flex gap-3">
        <Avatar
          size="md"
          src={post.author.avatarUrl ?? undefined}
          fallback={post.author.name}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <Link
              href={`/players/${post.author.username}`}
              className="font-semibold hover:underline"
            >
              {post.author.name}
            </Link>
            <span className="text-xs text-muted-foreground">
              @{post.author.username}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <Link
              href={`/community/${post.id}`}
              className="text-xs text-muted-foreground hover:underline"
              title={new Date(post.createdAt).toLocaleString()}
            >
              {relativeTime(post.createdAt)}
            </Link>
            {post.pinnedAt ? (
              <span
                className="inline-flex items-center gap-1 text-xs text-primary"
                title="Pinned by moderators"
              >
                <Pin className="size-3" /> Pinned
              </span>
            ) : null}
            {post.isHidden && isAdmin ? (
              <span className="inline-flex items-center gap-1 text-xs text-warning">
                <EyeOff className="size-3" /> Hidden
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              {viewerId && !isAuthor ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onReport}
                    title="Report"
                    aria-label="Report"
                    data-testid={`post-report-${post.id}`}
                  >
                    <Flag className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onBlock}
                    title={`Block @${post.author.username}`}
                    aria-label="Block author"
                    data-testid={`post-block-${post.id}`}
                  >
                    <ShieldOff className="size-3.5" />
                  </Button>
                </>
              ) : null}
              {isAdmin ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onTogglePin}
                    title={post.pinnedAt ? "Unpin" : "Pin"}
                    aria-label="Pin"
                    data-testid={`post-pin-${post.id}`}
                  >
                    <Pin className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onToggleHide}
                    title={post.isHidden ? "Unhide" : "Hide"}
                    aria-label="Hide"
                    data-testid={`post-hide-${post.id}`}
                  >
                    <EyeOff className="size-3.5" />
                  </Button>
                </>
              ) : null}
              {(isAuthor || isAdmin) && !editing ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(true)}
                    data-testid={`post-edit-${post.id}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDelete}
                    data-testid={`post-delete-${post.id}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <Input
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                data-testid={`post-edit-input-${post.id}`}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setDraftBody(post.body);
                  }}
                >
                  <X className="size-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={onSaveEdit} loading={savingEdit}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm mt-1">
              <CommunityRichText body={post.body} />
            </p>
          )}

          {post.imageUrls.length > 0 ? (
            <CommunityImages urls={post.imageUrls} />
          ) : null}

          {post.quotedPost ? <QuoteCard post={post.quotedPost} /> : null}

          {post.city ? (
            <p className="text-xs text-muted-foreground mt-1">{post.city.name}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <ReactionBar
              postId={post.id}
              total={post.reactionTotal}
              counts={post.reactionCounts}
              viewerReactions={post.viewerReactions}
              viewerId={viewerId}
            />
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
              data-testid={`post-comments-${post.id}`}
            >
              <MessageCircle className="size-3.5" />
              {post.commentCount}
            </button>
            {!post.quotedPost && onQuote ? (
              <button
                type="button"
                onClick={() => onQuote(post)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
                data-testid={`post-quote-${post.id}`}
                aria-label="Quote post"
              >
                <Quote className="size-3.5" />
                {post.quoteCount > 0 ? post.quoteCount : null}
              </button>
            ) : null}
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
              data-testid={`post-copy-link-${post.id}`}
              aria-label="Copy permalink"
            >
              <Link2 className="size-3.5" />
            </button>
          </div>

          {showComments ? (
            <CommentsThread
              postId={post.id}
              viewerId={viewerId}
              isAdmin={isAdmin}
              highlightCommentId={highlightCommentId}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

const COMMENT_PAGE = 10;

function CommentsThread({
  postId,
  viewerId,
  isAdmin,
  highlightCommentId,
}: {
  postId: string;
  viewerId: string | null;
  isAdmin: boolean;
  highlightCommentId?: string;
}) {
  const toast = useToast();
  const { data, loading, refetch } = useQuery(CommunityCommentsQuery, {
    variables: { postId },
    fetchPolicy: "cache-and-network",
  });
  const [createComment, { loading: posting }] = useMutation(
    CreateCommunityCommentMutation,
  );
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [visible, setVisible] = useState<number>(COMMENT_PAGE);

  const comments = data?.communityPost?.comments ?? [];

  // Deep link: when ?c=<commentId> is in the URL or highlightCommentId is
  // passed in, ensure that comment is rendered (expand visible) + scrolled.
  useEffect(() => {
    if (!highlightCommentId || comments.length === 0) return;
    const idx = comments.findIndex((c) => c.id === highlightCommentId);
    if (idx >= 0 && idx >= visible) {
      setVisible(comments.length);
    }
    const el = document.getElementById(`comment-${highlightCommentId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/60");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/60");
      }, 2400);
    }
  }, [highlightCommentId, comments, visible]);

  async function onPost() {
    if (!viewerId) {
      toast.error("Sign in to comment");
      return;
    }
    const trimmed = body.trim();
    if (!trimmed) return;
    try {
      await createComment({
        variables: { postId, parentId: replyTo, body: trimmed },
        refetchQueries: [
          { query: CommunityCommentsQuery, variables: { postId } },
          { query: CommunityFeedQuery, variables: { first: 30 } },
        ],
      });
      setBody("");
      setReplyTo(null);
    } catch (e) {
      toast.error("Could not comment", e);
    }
  }

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesByParent = comments.reduce<
    Record<string, typeof comments>
  >((acc, c) => {
    if (c.parentId) {
      acc[c.parentId] = acc[c.parentId] ?? [];
      acc[c.parentId].push(c);
    }
    return acc;
  }, {});

  const shown = topLevel.slice(0, visible);
  const hasMore = visible < topLevel.length;

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {loading && comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : null}
      {shown.map((c) => (
        <CommentRow
          key={c.id}
          postId={postId}
          comment={c}
          replies={repliesByParent[c.id] ?? []}
          viewerId={viewerId}
          isAdmin={isAdmin}
          onReply={(id) => setReplyTo(id)}
          onChanged={() => refetch()}
        />
      ))}
      {hasMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setVisible((v) => v + COMMENT_PAGE)}
            data-testid={`load-more-comments-${postId}`}
          >
            Load more comments ({topLevel.length - visible})
          </Button>
        </div>
      ) : null}
      {viewerId ? (
        <div className="space-y-2">
          {replyTo ? (
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              Replying ·{" "}
              <button
                className="underline"
                onClick={() => setReplyTo(null)}
                type="button"
              >
                cancel
              </button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Input
              placeholder={
                replyTo
                  ? "Write a reply… use @name or #tag"
                  : "Write a comment… use @name or #tag"
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onPost();
              }}
              data-testid={`comment-input-${postId}`}
            />
            <Button
              size="sm"
              onClick={onPost}
              loading={posting}
              disabled={!body.trim()}
              data-testid={`comment-submit-${postId}`}
            >
              Post
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Sign in to comment.</p>
      )}
    </div>
  );
}

type Comment = NonNullable<
  ResultOf<typeof CommunityCommentsQuery>["communityPost"]
>["comments"][number];

function CommentRow({
  postId,
  comment,
  replies,
  viewerId,
  isAdmin,
  onReply,
  onChanged,
}: {
  postId: string;
  comment: Comment;
  replies: Comment[];
  viewerId: string | null;
  isAdmin: boolean;
  onReply: (id: string) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [update, { loading: updating }] = useMutation(
    UpdateCommunityCommentMutation,
  );
  const [del] = useMutation(DeleteCommunityCommentMutation);
  const canEdit = viewerId === comment.author.id || isAdmin;

  async function onSave() {
    const body = draft.trim();
    if (!body || body === comment.body) {
      setEditing(false);
      return;
    }
    try {
      await update({ variables: { id: comment.id, body } });
      setEditing(false);
      onChanged();
    } catch (e) {
      toast.error("Could not update", e);
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: "Delete this comment?",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await del({ variables: { id: comment.id } });
      onChanged();
    } catch (e) {
      toast.error("Could not delete", e);
    }
  }

  async function copyCommentLink() {
    const base =
      typeof window !== "undefined" ? window.location.origin : "";
    try {
      await navigator.clipboard.writeText(
        `${base}/community/${postId}?c=${comment.id}`,
      );
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <div
      id={`comment-${comment.id}`}
      className="flex gap-2 text-sm rounded-md transition-shadow"
      data-testid={`comment-${comment.id}`}
    >
      <Avatar
        size="sm"
        src={comment.author.avatarUrl ?? undefined}
        fallback={comment.author.name}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <Link
            href={`/players/${comment.author.username}`}
            className="font-semibold hover:underline"
          >
            {comment.author.name}
          </Link>
          <span className="text-xs text-muted-foreground">
            @{comment.author.username}
          </span>
          {comment.editedAt ? (
            <span className="text-xs text-muted-foreground">(edited)</span>
          ) : null}
        </div>
        {editing ? (
          <div className="mt-1 flex gap-1.5">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button size="sm" onClick={onSave} loading={updating}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setDraft(comment.body);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">
            <CommunityRichText body={comment.body} />
          </p>
        )}
        <div className="mt-1 flex items-center gap-2 text-xs">
          {viewerId ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              onClick={() => onReply(comment.id)}
              data-testid={`comment-reply-${comment.id}`}
            >
              <Reply className="size-3" /> Reply
            </button>
          ) : null}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={copyCommentLink}
            aria-label="Copy link"
            data-testid={`comment-copy-link-${comment.id}`}
          >
            <Link2 className="inline size-3" />
          </button>
          {canEdit && !editing ? (
            <>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setEditing(true)}
                data-testid={`comment-edit-${comment.id}`}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                data-testid={`comment-delete-${comment.id}`}
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
        {replies.length > 0 ? (
          <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
            {replies.map((r) => (
              <CommentRow
                key={r.id}
                postId={postId}
                comment={r}
                replies={[]}
                viewerId={viewerId}
                isAdmin={isAdmin}
                onReply={onReply}
                onChanged={onChanged}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
