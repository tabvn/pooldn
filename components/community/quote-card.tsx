import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { CommunityRichText } from "@/components/community/rich-text";

type QuotedPost = {
  id: string;
  body: string;
  imageUrls: string[];
  createdAt: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  };
};

/**
 * Compact preview of a quoted CommunityPost rendered inline inside the
 * quoting post. Clicking anywhere routes to the original's permalink.
 */
export function QuoteCard({ post }: { post: QuotedPost }) {
  return (
    <Link
      href={`/community/${post.id}`}
      className="mt-2 block rounded-lg border border-border bg-secondary/30 px-3 py-2 transition hover:border-primary/40"
      data-testid={`quoted-post-${post.id}`}
    >
      <div className="flex items-center gap-2">
        <Avatar
          size="sm"
          src={post.author.avatarUrl ?? undefined}
          fallback={post.author.name}
        />
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className="font-semibold">{post.author.name}</span>
          <span className="text-muted-foreground">@{post.author.username}</span>
        </div>
      </div>
      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
        <CommunityRichText body={post.body} />
      </p>
      {post.imageUrls.length > 0 ? (
        <div className="mt-1.5 flex gap-1">
          {post.imageUrls.slice(0, 3).map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={u}
              alt=""
              className="h-12 w-12 rounded object-cover"
            />
          ))}
          {post.imageUrls.length > 3 ? (
            <span className="inline-flex h-12 w-12 items-center justify-center rounded bg-secondary text-xs text-muted-foreground">
              +{post.imageUrls.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}
