import * as React from "react";
import { Ghost } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeMap = {
  xs: "size-5 text-[11px]",
  sm: "size-7 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-lg",
} as const;

// Round-88 — the ghost mark for a placeholder (shell) profile. Sized per
// avatar size so it reads at 20px and at 80px.
const ghostIconSize = {
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
  xl: "size-10",
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
  /**
   * Round-88 — this profile is an unclaimed placeholder (User.isShell). Renders
   * a ghost mark on a dashed muted ring INSTEAD of a face, so a placeholder is
   * never mistaken for a real player at a glance. Wins over `src`: a shell has
   * no photo of its own, and an organizer-set one would be misleading.
   */
  ghost?: boolean;
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
  ghost = false,
  className,
  ...props
}: AvatarProps) {
  if (ghost) {
    return (
      <div
        data-slot="avatar"
        data-ghost="true"
        aria-label={alt ?? (fallback ? `${fallback} (placeholder)` : "placeholder")}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/50 bg-muted text-muted-foreground",
          sizeMap[size],
          className,
        )}
        {...props}
      >
        <Ghost className={ghostIconSize[size]} strokeWidth={1.75} />
      </div>
    );
  }
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
