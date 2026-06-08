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

export function CompetitionStatusChip({ status }: { status: CompetitionStatus }) {
  return <Badge variant={competitionVariant[status]}>{format(status)}</Badge>;
}

export function ApplicationStatusChip({ status }: { status: ApplicationStatus }) {
  return <Badge variant={applicationVariant[status]}>{format(status)}</Badge>;
}

export function MatchStatusChip({ status }: { status: MatchStatus }) {
  return <Badge variant={matchVariant[status]}>{format(status)}</Badge>;
}
