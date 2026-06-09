"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Bookmark, BookmarkCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { FollowEntityType } from "@/lib/generated/prisma/enums";
import {
  FollowEntityMutation,
  UnfollowEntityMutation,
} from "@/lib/graphql/operations/follow.operations";

export function FollowButton({
  entityType,
  entityId,
  isFollowing,
  followerCount,
  followersHref,
  signedIn,
}: {
  entityType: FollowEntityType;
  entityId: string;
  isFollowing: boolean;
  followerCount?: number;
  /**
   * Optional href for the follower-count chip — clicking opens the followers
   * list. Pass e.g. `/competitions/{slug}/followers` or `/teams/{slug}/followers`.
   */
  followersHref?: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [follow, fState] = useMutation(FollowEntityMutation);
  const [unfollow, uState] = useMutation(UnfollowEntityMutation);
  const busy = fState.loading || uState.loading;

  async function toggle() {
    try {
      if (isFollowing) {
        await unfollow({ variables: { entityType, entityId } });
        toast.success("Unfollowed");
      } else {
        await follow({ variables: { entityType, entityId } });
        toast.success("Following");
      }
      router.refresh();
    } catch (e) {
      toast.error("Could not update follow", e);
    }
  }

  // Clickable follower count — surfaces the FollowerList page.
  const countChip =
    typeof followerCount === "number" && followerCount > 0 && followersHref ? (
      <Link
        href={followersHref}
        data-testid="followers-count-link"
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground"
      >
        <Users className="size-3.5" />
        {followerCount}
      </Link>
    ) : null;

  if (!signedIn) {
    return countChip;
  }

  return (
    <div className="inline-flex items-center gap-2">
      {countChip}
      <Button
        variant={isFollowing ? "secondary" : "outline"}
        onClick={toggle}
        loading={busy}
        iconBefore={
          isFollowing ? (
            <BookmarkCheck className="size-4" />
          ) : (
            <Bookmark className="size-4" />
          )
        }
      >
        {isFollowing ? "Following" : "Follow"}
      </Button>
    </div>
  );
}
