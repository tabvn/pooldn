import type { Subjects } from "@casl/prisma";
import type {
  User,
  Team,
  TeamMember,
  Competition,
  CompetitionApplication,
  Matchday,
  Match,
  MatchFrame,
  Standing,
  PlayerCompStat,
  Venue,
  City,
  Country,
  Notification,
  Session,
} from "@/lib/generated/prisma/client";

export type AppSubjects = Subjects<{
  User: User;
  Team: Team;
  TeamMember: TeamMember;
  Competition: Competition;
  CompetitionApplication: CompetitionApplication;
  Matchday: Matchday;
  Match: Match;
  MatchFrame: MatchFrame;
  Standing: Standing;
  PlayerCompStat: PlayerCompStat;
  Venue: Venue;
  City: City;
  Country: Country;
  Notification: Notification;
  Session: Session;
}>;

export type AppAction =
  | "manage"
  | "create"
  | "read"
  | "update"
  | "delete"
  | "cancel"
  | "approve"
  | "reject";
