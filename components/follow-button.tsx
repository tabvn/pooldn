"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Bookmark, BookmarkCheck } from "lucide-react";
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
  signedIn,
}: {
  entityType: FollowEntityType;
  entityId: string;
  isFollowing: boolean;
  followerCount?: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [follow, fState] = useMutation(FollowEntityMutation);
  const [unfollow, uState] = useMutation(UnfollowEntityMutation);
  const busy = fState.loading || uState.loading;

  if (!signedIn) {
    return null;
  }

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
      toast.error(
        "Could not update follow",
        e instanceof Error ? e.message : undefined,
      );
    }
  }

  return (
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
      {typeof followerCount === "number" && followerCount > 0 ? (
        <span className="ml-2 rounded-md bg-background/40 px-1.5 py-0.5 text-[10px] font-bold">
          {followerCount}
        </span>
      ) : null}
    </Button>
  );
}
