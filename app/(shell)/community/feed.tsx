"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import type { ResultOf } from "@graphql-typed-document-node/core";
import { Flame, Hash, ImagePlus, Loader2, X } from "lucide-react";
import { QuoteCard } from "@/components/community/quote-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import {
  CommunityFeedQuery,
  CreatePostMutation,
  TrendingCommunityPostsQuery,
} from "@/lib/graphql/operations/community.operations";
import { PostCard } from "./post-card";

type FeedPost = ResultOf<typeof CommunityFeedQuery>["communityPosts"][number];

const PAGE = 30;
const MAX_IMAGES = 4;

export function CommunityFeed({
  signedIn,
  initialTag,
  cityId,
}: {
  signedIn: boolean;
  initialTag: string | null;
  /** SSR-resolved from the header city cookie. The header's CitySelector
   *  is the only city control now — the feed reflects that scope. */
  cityId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Read the active tag directly from the URL so client-side nav
  // (e.g. clicking a #hashtag chip) updates the filter without a remount.
  const urlTag = searchParams.get("tag");
  const tag = urlTag && urlTag.length > 0 ? urlTag : initialTag;
  function setTag(next: string | null) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set("tag", next);
    else sp.delete("tag");
    const qs = sp.toString();
    router.replace(`/community${qs ? `?${qs}` : ""}`);
  }
  const [mode, setMode] = useState<"latest" | "trending">("latest");
  const [body, setBody] = useState("");
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [quotedPost, setQuotedPost] = useState<FeedPost | null>(null);

  const { data: viewerData } = useQuery(ViewerQuery, { errorPolicy: "ignore" });
  const viewer = viewerData?.viewer ?? null;
  const isAdmin = viewer?.role === "SUPER_ADMIN";

  const [createPost, { loading: posting }] = useMutation(CreatePostMutation);

  // Trending tab — single batched response (server already orders by score).
  const trending = useQuery(TrendingCommunityPostsQuery, {
    variables: { limit: 20 },
    skip: mode !== "trending",
    fetchPolicy: "cache-and-network",
  });

  // Latest feed — cursor pagination via local accumulator.
  const [feedPages, setFeedPages] = useState<FeedPost[]>([]);
  const [feedDone, setFeedDone] = useState(false);
  const {
    data: feedData,
    loading: feedLoading,
    fetchMore,
    refetch,
  } = useQuery(CommunityFeedQuery, {
    variables: {
      first: PAGE,
      tag: tag ?? undefined,
      cityId: cityId ?? undefined,
    },
    skip: mode !== "latest",
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (feedData?.communityPosts) {
      setFeedPages(feedData.communityPosts);
      setFeedDone(feedData.communityPosts.length < PAGE);
    }
  }, [feedData]);

  async function loadMore() {
    const last = feedPages[feedPages.length - 1];
    if (!last) return;
    const r = await fetchMore({
      variables: { after: last.id },
    });
    const next = r.data?.communityPosts ?? [];
    setFeedPages((prev) => [...prev, ...next]);
    if (next.length < PAGE) setFeedDone(true);
  }

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!viewer) {
      toast.error("Sign in to upload images");
      return;
    }
    const room = MAX_IMAGES - draftImages.length;
    if (room <= 0) {
      toast.error(`At most ${MAX_IMAGES} images per post`);
      return;
    }
    const queue = Array.from(files).slice(0, room);
    try {
      for (const f of queue) {
        const fd = new FormData();
        fd.set("kind", "community-image");
        fd.set("ownerId", viewer.id);
        fd.set("file", f);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Upload failed");
        }
        const json = (await res.json()) as { url: string };
        setDraftImages((prev) => [...prev, json.url]);
      }
    } catch (e) {
      toast.error("Upload failed", e);
    }
  }

  async function onPost() {
    const trimmed = body.trim();
    if (!trimmed) return;
    try {
      await createPost({
        variables: {
          input: {
            body: trimmed,
            // New posts inherit the header city scope so the feed and the
            // composer stay consistent — "post into the city you're
            // viewing". The composer's own location switcher is gone.
            cityId: cityId ?? null,
            imageUrls: draftImages,
            quotedPostId: quotedPost?.id ?? null,
          },
        },
      });
      setBody("");
      setDraftImages([]);
      setQuotedPost(null);
      toast.success("Posted");
      await refetch();
    } catch (e) {
      toast.error("Could not post", e);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Community</h1>
        <p className="text-sm text-muted-foreground">
          Local pool talk — feature ideas, brags, calls for matches.
        </p>
      </header>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("latest")}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            mode === "latest"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
          }`}
          data-testid="community-tab-latest"
        >
          Latest
        </button>
        <button
          type="button"
          onClick={() => setMode("trending")}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
            mode === "trending"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
          }`}
          data-testid="community-tab-trending"
        >
          <Flame className="size-3" /> Trending
        </button>
        {tag ? (
          <Badge
            variant="primary"
            className="cursor-pointer"
            onClick={() => setTag(null)}
          >
            <Hash className="size-3" /> {tag} <X className="size-3" />
          </Badge>
        ) : null}
      </div>

      {/* Composer */}
      {signedIn ? (
        <Card>
          <CardContent className="space-y-2">
            {quotedPost ? (
              <div className="relative">
                <QuoteCard
                  post={{
                    id: quotedPost.id,
                    body: quotedPost.body,
                    imageUrls: quotedPost.imageUrls,
                    createdAt: quotedPost.createdAt,
                    author: quotedPost.author,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setQuotedPost(null)}
                  className="absolute right-2 top-2 rounded-full bg-card border border-border p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Clear quote"
                  data-testid="clear-quote"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : null}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                quotedPost
                  ? "Add your thoughts on this post… use @name or #tag"
                  : "Say something to your league… use @name or #tag"
              }
              rows={3}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-testid="community-input"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onPost();
              }}
            />
            {draftImages.length > 0 ? (
              <div className="grid grid-cols-4 gap-1.5">
                {draftImages.map((u, i) => (
                  <div
                    key={u}
                    className="relative aspect-square overflow-hidden rounded-md border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() =>
                        setDraftImages((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                      aria-label="Remove image"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void onUpload(e.target.files);
                    e.currentTarget.value = "";
                  }}
                  data-testid="community-image-input"
                />
                <ImagePlus className="size-4" />
                Add images
                <span className="text-muted-foreground/70">
                  ({draftImages.length}/{MAX_IMAGES})
                </span>
              </label>
              <Button
                size="sm"
                loading={posting}
                disabled={!body.trim()}
                onClick={onPost}
                data-testid="community-submit"
              >
                Post
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Sign in to post.
            </span>
            <Link href="/sign-in?next=/community">
              <Button variant="outline" size="sm">
                Sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Feed */}
      {mode === "trending" ? (
        <div className="space-y-3">
          {trending.loading && !trending.data ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Loading trending…
            </p>
          ) : (trending.data?.trendingCommunityPosts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing trending in the last 7 days yet.
            </p>
          ) : (
            (trending.data?.trendingCommunityPosts ?? []).map((p) => (
              <PostCard
                key={p.id}
                post={p}
                viewerId={viewer?.id ?? null}
                isAdmin={isAdmin}
                onQuote={(qp) => {
                  setQuotedPost(qp);
                  setMode("latest");
                  if (typeof window !== "undefined") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3" data-testid="community-feed">
          {feedLoading && feedPages.length === 0 ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Loading…
            </p>
          ) : feedPages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tag ? `No posts with #${tag} yet.` : "No posts yet."}
            </p>
          ) : (
            feedPages.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                viewerId={viewer?.id ?? null}
                isAdmin={isAdmin}
                onQuote={(qp) => {
                  setQuotedPost(qp);
                  setMode("latest");
                  if (typeof window !== "undefined") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
              />
            ))
          )}
          {!feedDone && feedPages.length > 0 ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                loading={feedLoading}
                onClick={loadMore}
                data-testid="community-load-more"
              >
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
