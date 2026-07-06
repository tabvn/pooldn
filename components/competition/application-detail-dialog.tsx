"use client";

import { useState, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ApplicationDetailView } from "./application-detail-view";

/**
 * Round-50 — side-sheet wrapper around ApplicationDetailView. Triggered from
 * the applications list and the confirmed-teams strip so any viewer (organizer,
 * captain, public) can read the application detail without losing the page.
 *
 * Behaves like a shadcn Drawer/Sheet: slides in from the right, dims the
 * background, full-height. Mobile-friendly (max-w-96vw). The same internal
 * `ApplicationDetailView` powers the dedicated `/applications/[appId]` page
 * so the two surfaces never drift.
 *
 * `triggerLabel` controls the trigger text (pass null when a parent controls
 * `open`). `triggerVariant`/`triggerIcon`/`triggerClassName` style the trigger
 * so it can read primary on the captain's "Manage your team" card and ghost
 * on the organizer's "Review" button.
 */
export function ApplicationDetailDialog({
  applicationId,
  teamName,
  competitionName,
  viewerId,
  viewerRole,
  triggerLabel = "View",
  triggerVariant = "secondary",
  triggerIcon,
  triggerClassName,
  open: controlledOpen,
  onOpenChange,
}: {
  applicationId: string;
  /** When provided, the sheet title reads "{teamName} roster" instead of the
   *  generic "Application". Both call sites (confirmed-teams strip,
   *  applications list) have it handy, so we render the friendlier copy
   *  before the inner query finishes loading. */
  teamName?: string;
  /** Optional competition name shown in the sheet description as context. */
  competitionName?: string;
  viewerId: string | null;
  viewerRole: string | null;
  triggerLabel?: string | null;
  triggerVariant?: "primary" | "secondary" | "ghost";
  triggerIcon?: ReactNode;
  triggerClassName?: string;
  /** Controlled open state — pass with `triggerLabel={null}` to drive the
   *  sheet from an external control (e.g. a kebab dropdown item). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const icon = triggerIcon ?? <Eye className="size-4" />;
  const title = teamName ? `${teamName} roster` : "Roster";
  const description = competitionName
    ? `Players ${teamName ? `${teamName} ` : ""}is fielding for ${competitionName}.`
    : "Players this team is fielding for the competition.";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {triggerLabel ? (
        <SheetTrigger
          render={
            <Button
              variant={triggerVariant}
              size="sm"
              data-testid={`open-application-${applicationId}`}
              className={triggerClassName}
            >
              {icon}
              {triggerLabel}
            </Button>
          }
        />
      ) : null}
      <SheetContent side="right" testId="application-detail-sheet">
        <SheetHeader onClose={() => setOpen(false)}>
          <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            {description}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <ApplicationDetailView
            applicationId={applicationId}
            viewerId={viewerId}
            viewerRole={viewerRole}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
