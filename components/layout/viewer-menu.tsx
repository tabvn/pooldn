"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { ChevronDown, LogOut, Settings, User as UserIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutMutation } from "@/lib/graphql/operations/auth.operations";

function shortName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

export function ViewerMenu({
  viewerName,
  viewerUsername,
  viewerAvatarUrl,
}: {
  viewerName: string | null;
  viewerUsername: string | null;
  viewerAvatarUrl: string | null;
}) {
  const router = useRouter();
  const [logout, { loading }] = useMutation(LogoutMutation);

  if (!viewerName || !viewerUsername) {
    return (
      <Link
        href="/sign-in"
        className="text-sm font-semibold text-primary hover:underline"
      >
        Sign in
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="h-auto w-auto border border-border bg-secondary/40 px-2 py-1 gap-2 rounded-md hover:bg-secondary/70"
        aria-label="Open viewer menu"
      >
        <Avatar
          size="sm"
          src={viewerAvatarUrl ?? undefined}
          fallback={viewerName}
        />
        <span className="text-sm font-semibold">{shortName(viewerName)}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          render={(props) => (
            <Link href={`/profile/${viewerUsername}`} {...props} />
          )}
        >
          <UserIcon className="size-4" />
          <span>View profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          render={(props) => <Link href="/settings" {...props} />}
        >
          <Settings className="size-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="danger"
          disabled={loading}
          onClick={async () => {
            await logout();
            router.push("/sign-in");
            router.refresh();
          }}
        >
          <LogOut className="size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
