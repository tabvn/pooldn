"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@apollo/client/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  CommunityFeedQuery,
  CreatePostMutation,
} from "@/lib/graphql/operations/community.operations";

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

export function CommunityFeed({ signedIn }: { signedIn: boolean }) {
  const toast = useToast();
  const { data, refetch } = useQuery(CommunityFeedQuery, {
    variables: { limit: 50 },
  });
  const [createPost, { loading }] = useMutation(CreatePostMutation);
  const [body, setBody] = useState("");

  const posts = data?.communityPosts ?? [];

  async function onPost() {
    if (!body.trim()) return;
    await createPost({ variables: { input: { body: body.trim() } } });
    setBody("");
    toast.success("Posted");
    await refetch();
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Community</h1>
        <p className="text-sm text-muted-foreground">
          Local pool talk — feature ideas, brags, calls for matches.
        </p>
      </header>

      {signedIn ? (
        <Card>
          <CardContent className="space-y-2">
            <Input
              placeholder="Say something to your league…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onPost();
              }}
              data-testid="community-input"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                loading={loading}
                disabled={!body.trim()}
                onClick={onPost}
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

      <ul className="space-y-3">
        {posts.length === 0 ? (
          <li className="text-sm text-muted-foreground">No posts yet.</li>
        ) : (
          posts.map((p) => (
            <li key={p.id}>
              <Card>
                <CardContent className="flex gap-3">
                  <Avatar
                    size="md"
                    src={p.author.avatarUrl ?? undefined}
                    fallback={p.author.name}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <Link
                        href={`/profile/${p.author.username}`}
                        className="font-semibold hover:underline"
                      >
                        {p.author.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        @{p.author.username}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span
                        className="text-xs text-muted-foreground"
                        title={new Date(p.createdAt).toLocaleString()}
                      >
                        {relativeTime(p.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap mt-1">{p.body}</p>
                    {p.city ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.city.name}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
