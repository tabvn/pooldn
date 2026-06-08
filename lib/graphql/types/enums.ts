import { builder } from "../builder";
import {
  UserRole,
  CompetitionStatus,
  CompetitionFormat,
  CompetitionType,
  GameType,
  ApplicationStatus,
  MatchStatus,
  SchedulingType,
} from "@/lib/generated/prisma/enums";

export const UserRoleEnum = builder.enumType(UserRole, { name: "UserRole" });
export const CompetitionStatusEnum = builder.enumType(CompetitionStatus, {
  name: "CompetitionStatus",
});
export const CompetitionFormatEnum = builder.enumType(CompetitionFormat, {
  name: "CompetitionFormat",
});
export const CompetitionTypeEnum = builder.enumType(CompetitionType, {
  name: "CompetitionType",
});
export const GameTypeEnum = builder.enumType(GameType, { name: "GameType" });
export const ApplicationStatusEnum = builder.enumType(ApplicationStatus, {
  name: "ApplicationStatus",
});
export const MatchStatusEnum = builder.enumType(MatchStatus, {
  name: "MatchStatus",
});
export const SchedulingTypeEnum = builder.enumType(SchedulingType, {
  name: "SchedulingType",
});
