import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getViewer } from "@/lib/auth/server";
import { getClient } from "@/lib/apollo/client";
import { CommunityPostByIdQuery } from "@/lib/graphql/operations/community.operations";
import { PostPermalinkView } from "./view";

/**
 * Round-A4 — Permalink page. The post body + a fully expanded comments
 * thread; if ?c=<commentId> is on the URL we scroll-and-highlight that
 * comment on mount (see view.tsx).
 */
export default async function CommunityPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const highlight = typeof sp.c === "string" ? sp.c : null;
  const [{ data }, viewer] = await Promise.all([
    getClient().query({
      query: CommunityPostByIdQuery,
      variables: { id },
    }),
    getViewer(),
  ]);
  const post = data?.communityPost;
  if (!post) notFound();
  const isAdmin = viewer?.role === "SUPER_ADMIN";
  return (
    <div className="p-8 max-w-3xl space-y-4">
      <Link
        href="/community"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to feed
      </Link>
      <PostPermalinkView
        post={post}
        viewerId={viewer?.id ?? null}
        isAdmin={isAdmin}
        highlightCommentId={highlight}
      />
    </div>
  );
}
