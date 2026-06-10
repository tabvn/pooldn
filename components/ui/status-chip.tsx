import { Badge, type BadgeProps } from "./badge";
import type {
  CompetitionStatus,
  ApplicationStatus,
  MatchStatus,
} from "@/lib/generated/prisma/enums";

const competitionVariant: Record<CompetitionStatus, BadgeProps["variant"]> = {
  DRAFT: "neutral",
  OPEN_FOR_APPLICATIONS: "primary",
  APPLICATIONS_CLOSED: "warning",
  ONGOING: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const applicationVariant: Record<ApplicationStatus, BadgeProps["variant"]> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
  WAITLISTED: "info",
  INVITED: "primary",
};

const matchVariant: Record<MatchStatus, BadgeProps["variant"]> = {
  SCHEDULED: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
  POSTPONED: "warning",
};

function format(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

// Round-50 — friendlier labels for the enum values that ship on every
// card/chip. The raw enums stay the source of truth; these maps only
// touch the UI surface.
export const competitionStatusLabel: Record<CompetitionStatus, string> = {
  DRAFT: "Draft",
  OPEN_FOR_APPLICATIONS: "Accepting teams",
  APPLICATIONS_CLOSED: "Sign-ups closed",
  ONGOING: "In play",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const applicationLabel: Record<ApplicationStatus, string> = {
  PENDING: "Awaiting review",
  APPROVED: "Confirmed",
  REJECTED: "Rejected",
  CANCELLED: "Withdrawn",
  WAITLISTED: "Waitlisted",
  INVITED: "Invited",
};

const matchLabel: Record<MatchStatus, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "Live",
  COMPLETED: "Final",
  CANCELLED: "Cancelled",
  POSTPONED: "Postponed",
};

export function CompetitionStatusChip({ status }: { status: CompetitionStatus }) {
  return (
    <Badge variant={competitionVariant[status]}>
      {competitionStatusLabel[status] ?? format(status)}
    </Badge>
  );
}

export function ApplicationStatusChip({ status }: { status: ApplicationStatus }) {
  return (
    <Badge variant={applicationVariant[status]}>
      {applicationLabel[status] ?? format(status)}
    </Badge>
  );
}

export function MatchStatusChip({ status }: { status: MatchStatus }) {
  return (
    <Badge variant={matchVariant[status]}>
      {matchLabel[status] ?? format(status)}
    </Badge>
  );
}
