import * as React from "react";
import { cn } from "@/lib/utils";

const sizeMap = {
  sm: "size-7 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-lg",
} as const;

/**
 * Reusable Avatar (Round-19). Renders:
 *   1. The uploaded image (`src`) if provided.
 *   2. Otherwise a deterministic dicebear placeholder seeded by `fallback`
 *      so every entity has a visual identity instead of bare initials.
 *   3. Only when there's NO image and NO fallback text do we render the
 *      monogram fallback.
 *
 * `shape` picks the dicebear style — "user" for player avatars and team
 * logos use the same component everywhere in the app.
 */
export type AvatarProps = React.HTMLAttributes<HTMLDivElement> & {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: keyof typeof sizeMap;
  /** Picks the placeholder style. Defaults to "user". */
  shape?: "user" | "team" | "competition";
  /** Opt out of the auto-placeholder and force initials when src is null. */
  disablePlaceholder?: boolean;
};

function initials(text: string | undefined) {
  if (!text) return "?";
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function placeholderUrl(shape: NonNullable<AvatarProps["shape"]>, seed: string) {
  const slug = encodeURIComponent(seed);
  if (shape === "team") {
    return `https://api.dicebear.com/9.x/shapes/svg?seed=${slug}&backgroundColor=d0f30d,9810fa,1c2280,0b4f4a&backgroundType=gradientLinear`;
  }
  if (shape === "competition") {
    return `https://api.dicebear.com/9.x/glass/svg?seed=${slug}`;
  }
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${slug}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

export function Avatar({
  src,
  alt,
  fallback,
  size = "md",
  shape = "user",
  disablePlaceholder = false,
  className,
  ...props
}: AvatarProps) {
  const resolved =
    src ||
    (!disablePlaceholder && fallback ? placeholderUrl(shape, fallback) : null);
  return (
    <div
      data-slot="avatar"
      data-shape={shape}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-foreground font-semibold",
        sizeMap[size],
        className,
      )}
      {...props}
    >
      {resolved ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved}
          alt={alt ?? fallback ?? "avatar"}
          // Round-47 — Google (lh3.googleusercontent.com) returns 403 when
          // the Referer header is the dev origin. no-referrer makes the
          // browser omit the header so the image loads. Harmless for
          // self-hosted /uploads and dicebear placeholders.
          referrerPolicy="no-referrer"
          className="size-full object-cover"
        />
      ) : (
        <span>{initials(fallback ?? alt)}</span>
      )}
    </div>
  );
}
