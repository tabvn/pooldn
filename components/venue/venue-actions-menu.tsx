"use client";

import Link from "next/link";
import { MoreVertical, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Kebab dropdown for venue-management actions, so the hero stays clean.
 * Only renders for users who can edit (organizers / admins).
 */
export function VenueActionsMenu({
  slug,
  canEdit,
}: {
  slug: string;
  canEdit: boolean;
}) {
  if (!canEdit) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Venue actions"
        data-testid="venue-actions-menu"
        className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-secondary/40 hover:bg-secondary"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          render={(props) => <Link href={`/venues/${slug}/edit`} {...props} />}
          data-testid="venue-actions-edit"
        >
          <Pencil className="size-4" />
          <span>Edit venue</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
