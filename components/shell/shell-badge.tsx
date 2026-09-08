import { Ghost } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Round-88 — the mark for a placeholder (shell) profile.
 *
 * Shells sit on rosters, in lineups and in standings next to real players, and
 * until now nothing on any public screen said so — the only tell was the admin
 * table. Every surface that can render a shell renders this next to the name,
 * paired with the ghost avatar (`<Avatar ghost />`).
 *
 * One vocabulary across the app: a PLAYER placeholder is "Unclaimed" (it is
 * waiting for the real person), a TEAM made of them is a "Placeholder team".
 */

export const SHELL_EXPLAINER =
  "Placeholder profiles let organizers run a competition before everyone in it has a PoolDN account. The real player claims theirs, and all their results come with it.";

export function ShellBadge({
  size = "sm",
  className,
  label = "Unclaimed",
  ...props
}: Omit<BadgeProps, "variant"> & { label?: string }) {
  return (
    <Badge
      variant="warning"
      size={size}
      className={cn("gap-1", className)}
      title={SHELL_EXPLAINER}
      data-testid="shell-badge"
      {...props}
    >
      <Ghost className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}

/** A team whose roster is still (partly) placeholders. */
export function ShellTeamBadge({
  unclaimedCount,
  size = "sm",
  className,
  ...props
}: Omit<BadgeProps, "variant"> & { unclaimedCount?: number }) {
  return (
    <ShellBadge
      size={size}
      className={className}
      label={
        unclaimedCount && unclaimedCount > 0
          ? `Placeholder team · ${unclaimedCount} unclaimed`
          : "Placeholder team"
      }
      {...props}
    />
  );
}
