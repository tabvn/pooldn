import { AbilityBuilder } from "@casl/ability";
import {
  createPrismaAbility,
  type PrismaAbility,
  type PrismaQuery,
} from "@casl/prisma";
import type { AppAction, AppSubjects } from "./subjects";

export type AppAbility = PrismaAbility<
  [AppAction, AppSubjects],
  PrismaQuery
>;

export type AbilityActor = {
  id: string;
  role:
    | "SUPER_ADMIN"
    | "ORGANIZER"
    | "TEAM_CAPTAIN"
    | "PLAYER"
    | "VIEWER";
} | null;

export function defineAbilityFor(actor: AbilityActor): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);

  // ── Public / guest baseline ───────────────────────────────────────────
  // Public viewers see published (non-DRAFT, non-CANCELLED) public comps.
  // Organizers see their own at every status via the per-role rule below.
  can("read", "Competition", {
    isPublic: true,
    status: {
      in: [
        "OPEN_FOR_APPLICATIONS",
        "APPLICATIONS_CLOSED",
        "ONGOING",
        "COMPLETED",
      ],
    },
  });
  can("read", ["Team", "Venue", "City", "Country"]);

  if (!actor) return build();

  // ── Per-role rules ────────────────────────────────────────────────────
  switch (actor.role) {
    case "SUPER_ADMIN": {
      // Special CASL sentinel — type system on a Prisma ability narrows
      // subjects to model names, but the runtime supports "all".
      (can as unknown as (a: AppAction, s: "all") => void)("manage", "all");
      break;
    }

    case "ORGANIZER": {
      // Organizers see published competitions via the public baseline above,
      // plus their own at every status via the manage rule below. They do
      // NOT see other organizers' DRAFT / CANCELLED competitions.
      can("manage", "Competition", { organizerId: actor.id });
      can("manage", "Matchday", {
        competition: { is: { organizerId: actor.id } },
      });
      can("manage", "Match", {
        matchday: {
          is: { competition: { is: { organizerId: actor.id } } },
        },
      });
      can(["read", "update", "approve", "reject"], "CompetitionApplication", {
        competition: { is: { organizerId: actor.id } },
      });
      // Venues are a shared resource — any ORGANIZER can manage any venue.
      can("manage", "Venue");
      can("update", "User", { id: actor.id });
      can("read", ["User", "Team", "Standing", "PlayerCompStat"]);
      can("read", "Notification", { userId: actor.id });
      break;
    }

    case "TEAM_CAPTAIN": {
      can("read", ["Competition", "Team", "Standing", "PlayerCompStat"]);
      can("create", "CompetitionApplication");
      can("cancel", "CompetitionApplication", {
        team: { is: { captainId: actor.id } },
      });
      can("read", "CompetitionApplication", {
        team: { is: { captainId: actor.id } },
      });
      can("manage", "Team", { captainId: actor.id });
      can("manage", "TeamMember", {
        team: { is: { captainId: actor.id } },
      });
      can("update", "Match", {
        OR: [
          { homeTeam: { is: { captainId: actor.id } } },
          { awayTeam: { is: { captainId: actor.id } } },
        ],
      });
      can("update", "MatchFrame", {
        match: {
          is: {
            OR: [
              { homeTeam: { is: { captainId: actor.id } } },
              { awayTeam: { is: { captainId: actor.id } } },
            ],
          },
        },
      });
      can("update", "User", { id: actor.id });
      can("read", "Notification", { userId: actor.id });
      break;
    }

    case "PLAYER": {
      can("read", ["Competition", "Team", "Standing", "PlayerCompStat"]);
      can("update", "User", { id: actor.id });
      can("read", "Notification", { userId: actor.id });
      break;
    }

    case "VIEWER":
    default: {
      // baseline only
      break;
    }
  }

  return build();
}
