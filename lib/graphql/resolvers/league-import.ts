import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { requireUser } from "@/lib/casl/guard";
import {
  createShellUser,
  buildClaimUrl,
  reissueClaimToken,
} from "@/lib/services/shell.service";
import {
  mergeShellIntoAccount,
  shellHasHistory,
} from "@/lib/services/shell-merge.service";
import {
  assertClaimEligible,
  competitionsForUser,
  findOtherPendingClaims,
  rejectClaims,
} from "@/lib/services/shell-claim.service";
import {
  consumeEmailToken,
  peekEmailToken,
} from "@/lib/services/email-token.service";

/**
 * Round-75 — admin tooling to seed an imported offline league with claimable
 * "shell" players and teams. Everything here is SUPER_ADMIN-only.
 *
 * The rest of the league (matchdays, frame-by-frame results) is entered through
 * the existing organizer staff match-flow; standings + MVP recompute from those
 * on completion. Real people take over their shells via /claim/<token>.
 */

function requireAdmin(ctx: { viewer: { id: string; role: string } | null }) {
  requireUser(ctx.viewer);
  if (ctx.viewer.role !== "SUPER_ADMIN") {
    throw new GraphQLError("Admins only", {
      extensions: { code: "FORBIDDEN" },
    });
  }
}

/**
 * Round-88 — placeholders stopped being an admin-only import tool. The whole
 * point is that an organizer can keep their competition running when some of
 * the players and teams in it aren't on PoolDN yet, so the organizer of THIS
 * competition may add them; admins may do it anywhere.
 */
async function requireCompetitionManager(
  ctx: {
    viewer: { id: string; role: string } | null;
    prisma: import("@/lib/generated/prisma/client").PrismaClient;
  },
  competitionId: string,
) {
  requireUser(ctx.viewer);
  const competition = await ctx.prisma.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      organizerId: true,
      cityId: true,
      maxPlayersPerTeam: true,
    },
  });
  if (!competition) {
    throw new GraphQLError("Competition not found", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  const isAdmin = ctx.viewer.role === "SUPER_ADMIN";
  if (!isAdmin && competition.organizerId !== ctx.viewer.id) {
    throw new GraphQLError(
      "Only this competition's organizer can add placeholder players or teams.",
      { extensions: { code: "FORBIDDEN" } },
    );
  }
  return competition;
}

type ShellClaimShape = {
  userId: string;
  name: string;
  username: string;
  claimUrl: string;
};

const ShellClaim = builder.objectRef<ShellClaimShape>("ShellClaim").implement({
  description:
    "A freshly-created shell player plus the private claim link an organizer distributes to the real person.",
  fields: (t) => ({
    userId: t.exposeID("userId"),
    name: t.exposeString("name"),
    username: t.exposeString("username"),
    claimUrl: t.exposeString("claimUrl"),
  }),
});

type ImportTeamResultShape = {
  teamId: string;
  teamSlug: string;
  claims: ShellClaimShape[];
};

const ImportLeagueTeamResult = builder
  .objectRef<ImportTeamResultShape>("ImportLeagueTeamResult")
  .implement({
    description:
      "Result of importing a shell team into a competition: the team + a claim link per player.",
    fields: (t) => ({
      teamId: t.exposeID("teamId"),
      teamSlug: t.exposeString("teamSlug"),
      claims: t.field({ type: [ShellClaim], resolve: (r) => r.claims }),
    }),
  });

const CreateShellPlayersInput = builder.inputType("CreateShellPlayersInput", {
  fields: (t) => ({
    names: t.stringList({ required: true }),
    cityId: t.id(),
    nationality: t.string(),
  }),
});

const ImportPlayerInput = builder.inputType("ImportPlayerInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    isCaptain: t.boolean(),
  }),
});

const ImportLeagueTeamInput = builder.inputType("ImportLeagueTeamInput", {
  fields: (t) => ({
    competitionId: t.id({ required: true }),
    name: t.string({ required: true }),
    slug: t.string({ required: true }),
    cityId: t.id(),
    homeVenueId: t.id(),
    players: t.field({ type: [ImportPlayerInput], required: true }),
  }),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

builder.mutationFields((t) => ({
  createShellPlayers: t.field({
    type: [ShellClaim],
    description:
      "Admin — batch-create shell (placeholder) players for an imported league. Returns a claim link per player to distribute privately.",
    args: { input: t.arg({ type: CreateShellPlayersInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      requireAdmin(ctx);
      const names = args.input.names
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
      if (names.length === 0) {
        throw new GraphQLError("Provide at least one player name", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const out: ShellClaimShape[] = [];
      for (const name of names) {
        const { user, claimToken } = await createShellUser(ctx.prisma, {
          name,
          cityId: args.input.cityId ? String(args.input.cityId) : null,
          nationality: args.input.nationality ?? null,
        });
        out.push({
          userId: user.id,
          name: user.name,
          username: user.username,
          claimUrl: buildClaimUrl(claimToken),
        });
      }
      return out;
    },
  }),

  importLeagueTeam: t.field({
    type: ImportLeagueTeamResult,
    description:
      "Organizer or admin — create a placeholder (shell) team with a placeholder captain, roster it into a competition as an APPROVED entry, and return a claim link per player. The competition can mix these with real teams; enter their matches/results afterward via the normal staff flow.",
    args: { input: t.arg({ type: ImportLeagueTeamInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      await requireCompetitionManager(ctx, String(args.input.competitionId));
      const input = args.input;
      const players = input.players
        .map((p) => ({ name: p.name.trim(), isCaptain: !!p.isCaptain }))
        .filter((p) => p.name.length > 0);
      if (players.length === 0) {
        throw new GraphQLError("A team needs at least one player", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const captainCount = players.filter((p) => p.isCaptain).length;
      if (captainCount !== 1) {
        throw new GraphQLError("Mark exactly one player as the captain", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const competition = await ctx.prisma.competition.findUnique({
        where: { id: String(input.competitionId) },
        select: { id: true, type: true, cityId: true },
      });
      if (!competition) {
        throw new GraphQLError("Competition not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      // City is the app's top-level filter and it's nullable on Team — a
      // placeholder team stamped NULL is invisible on every list surface. Fall
      // back to the competition's city rather than leaving it unfiled.
      const cityId = input.cityId ? String(input.cityId) : competition.cityId;
      // Team import only makes sense for team-based formats. An INDIVIDUAL
      // (Singles) comp is scheduled from applicantUserId, not team rosters, so a
      // team application here would be invisible to generateMatchdays — use
      // createShellPlayers + solo applications for Singles instead.
      if (competition.type === "INDIVIDUAL") {
        throw new GraphQLError(
          "This is a Singles competition — import individual players, not a team.",
          { extensions: { code: "BAD_USER_INPUT" } },
        );
      }

      const slug = slugify(input.slug) || slugify(input.name);
      const slugTaken = await ctx.prisma.team.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (slugTaken) {
        throw new GraphQLError("That team slug is already taken", {
          extensions: { code: "SLUG_TAKEN" },
        });
      }
      const nameTaken = await ctx.prisma.team.findFirst({
        where: { name: input.name.trim() },
        select: { id: true },
      });
      if (nameTaken) {
        throw new GraphQLError("That team name is already taken", {
          extensions: { code: "NAME_TAKEN" },
        });
      }

      // Create the shell players first (each needs its own claim token). Done
      // outside the team transaction so username/email uniqueness probing runs
      // against committed rows; the team+roster wiring is then atomic.
      const created: Array<{
        userId: string;
        name: string;
        username: string;
        cityId: string;
        claimToken: string;
        isCaptain: boolean;
      }> = [];
      for (const p of players) {
        const { user, claimToken } = await createShellUser(ctx.prisma, {
          name: p.name,
          cityId,
        });
        created.push({
          userId: user.id,
          name: user.name,
          username: user.username,
          cityId: user.cityId,
          claimToken,
          isCaptain: p.isCaptain,
        });
      }
      const captain = created.find((c) => c.isCaptain)!;
      // Team.cityId is NULLABLE and every list surface filters on it with
      // strict equality, so a placeholder team stamped NULL would be invisible
      // on /teams with no hint that anything was filtered. The competition's
      // city is the intent; fall back to the players' resolved city (which
      // createShellUser already defaults to the home city) rather than NULL.
      const teamCityId = cityId ?? captain.cityId;

      const team = await ctx.prisma.$transaction(async (tx) => {
        const t2 = await tx.team.create({
          data: {
            name: input.name.trim(),
            slug,
            // Round-88 — this team IS a placeholder: nobody on it has an
            // account. The flag clears itself once every member is claimed.
            isShell: true,
            captainId: captain.userId,
            cityId: teamCityId,
            homeVenueId: input.homeVenueId ? String(input.homeVenueId) : null,
            members: {
              create: created.map((c) => ({ userId: c.userId })),
            },
          },
        });
        // APPROVED application + roster so recomputeStandings (which only counts
        // approved apps with a team) and recomputeMvp pick this team up.
        await tx.competitionApplication.create({
          data: {
            competitionId: competition.id,
            teamId: t2.id,
            status: "APPROVED",
            reviewedAt: new Date(),
            // The captain is on the roster, so no separate roster-captain needed.
            applicationPlayers: {
              create: created.map((c) => ({
                userId: c.userId,
                name: c.name,
              })),
            },
          },
        });
        await tx.competitionRoster.createMany({
          data: created.map((c) => ({
            competitionId: competition.id,
            teamId: t2.id,
            userId: c.userId,
          })),
        });
        return t2;
      });

      return {
        teamId: team.id,
        teamSlug: team.slug,
        claims: created.map((c) => ({
          userId: c.userId,
          name: c.name,
          username: c.username,
          claimUrl: buildClaimUrl(c.claimToken),
        })),
      };
    },
  }),
}));

builder.mutationFields((t) => ({
  addShellPlayer: t.field({
    type: ShellClaim,
    description:
      "Round-88 — organizer or admin adds ONE placeholder player to their competition: onto a team's roster (team formats) or as a solo entrant (Singles). This is how a competition keeps running when a player isn't on PoolDN yet; the real person claims the profile later and inherits everything recorded under it.",
    args: {
      competitionId: t.arg.id({ required: true }),
      name: t.arg.string({ required: true }),
      teamId: t.arg.id({
        description:
          "Required for team formats — the entered team to add them to. Omit for Singles.",
      }),
    },
    resolve: async (_root, args, ctx) => {
      const competition = await requireCompetitionManager(
        ctx,
        String(args.competitionId),
      );
      const name = args.name.trim();
      if (!name) {
        throw new GraphQLError("Give the player a name.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      if (competition.type === "INDIVIDUAL") {
        if (args.teamId) {
          throw new GraphQLError(
            "This is a Singles competition — placeholder players enter on their own, not on a team.",
            { extensions: { code: "BAD_USER_INPUT" } },
          );
        }
        const { user, claimToken } = await createShellUser(ctx.prisma, {
          name,
          cityId: competition.cityId,
        });
        // APPROVED straight away: the organizer is adding someone they already
        // know is playing, and generateMatchdays reads approved entries.
        await ctx.prisma.competitionApplication.create({
          data: {
            competitionId: competition.id,
            applicantUserId: user.id,
            status: "APPROVED",
            reviewedAt: new Date(),
          },
        });
        return {
          userId: user.id,
          name: user.name,
          username: user.username,
          claimUrl: buildClaimUrl(claimToken),
        };
      }

      if (!args.teamId) {
        throw new GraphQLError(
          "Pick the team this player is on.",
          { extensions: { code: "BAD_USER_INPUT" } },
        );
      }
      const teamId = String(args.teamId);
      const application = await ctx.prisma.competitionApplication.findFirst({
        where: {
          competitionId: competition.id,
          teamId,
          status: { in: ["PENDING", "WAITLISTED", "APPROVED"] },
        },
        select: {
          id: true,
          status: true,
          _count: { select: { applicationPlayers: true } },
        },
      });
      if (!application) {
        throw new GraphQLError(
          "That team isn't entered in this competition.",
          { extensions: { code: "NOT_FOUND" } },
        );
      }
      const max = competition.maxPlayersPerTeam;
      if (max != null && application._count.applicationPlayers >= max) {
        throw new GraphQLError(
          `This competition caps rosters at ${max} players.`,
          { extensions: { code: "ROSTER_TOO_LARGE" } },
        );
      }
      const team = await ctx.prisma.team.findUniqueOrThrow({
        where: { id: teamId },
        select: { id: true, cityId: true },
      });
      const { user, claimToken } = await createShellUser(ctx.prisma, {
        name,
        cityId: team.cityId ?? competition.cityId,
      });
      await ctx.prisma.$transaction(async (tx) => {
        await tx.teamMember.create({ data: { teamId, userId: user.id } });
        await tx.applicationPlayer.create({
          data: { applicationId: application.id, userId: user.id, name },
        });
        // CompetitionRoster is the LOCKED roster, written on approval — only
        // mirror into it when the entry is already approved, or the Players
        // tab would list someone whose team hasn't been accepted yet.
        if (application.status === "APPROVED") {
          await tx.competitionRoster.create({
            data: { competitionId: competition.id, teamId, userId: user.id },
          });
        }
      });
      return {
        userId: user.id,
        name: user.name,
        username: user.username,
        claimUrl: buildClaimUrl(claimToken),
      };
    },
  }),

  removeShellPlayerFromCompetition: t.boolean({
    description:
      "Round-88 — organizer or admin removes a placeholder they added, as long as it has no results recorded and hasn't been claimed. Placeholders WITH results can't be deleted (that would orphan frames) — leave them for the real player to claim.",
    args: {
      competitionId: t.arg.id({ required: true }),
      userId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const competition = await requireCompetitionManager(
        ctx,
        String(args.competitionId),
      );
      const id = String(args.userId);
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id },
        select: { id: true, name: true, isShell: true },
      });
      if (!user.isShell) {
        throw new GraphQLError(
          "That profile belongs to a real player — remove them from the roster instead.",
          { extensions: { code: "NOT_A_SHELL" } },
        );
      }
      // Only a placeholder that plays in THIS competition, and only if this is
      // the only competition it's in — otherwise deleting it here would pull
      // someone out of another organizer's competition.
      const competitions = await competitionsForUser(ctx.prisma, id);
      if (!competitions.some((c) => c.id === competition.id)) {
        throw new GraphQLError(
          `${user.name} isn't in this competition.`,
          { extensions: { code: "NOT_FOUND" } },
        );
      }
      if (competitions.length > 1) {
        throw new GraphQLError(
          `${user.name} also plays in another competition, so removing the profile here would take them out of it. Ask an admin.`,
          { extensions: { code: "SHELL_IN_OTHER_COMPETITION" } },
        );
      }
      if (await shellHasHistory(ctx.prisma, id)) {
        throw new GraphQLError(
          `${user.name} already has results recorded — deleting them would orphan those frames. Leave the placeholder for the real player to claim.`,
          { extensions: { code: "SHELL_HAS_HISTORY" } },
        );
      }
      const captained = await ctx.prisma.team.count({ where: { captainId: id } });
      if (captained > 0) {
        throw new GraphQLError(
          `${user.name} captains a placeholder team — remove the team instead.`,
          { extensions: { code: "SHELL_IS_CAPTAIN" } },
        );
      }
      await ctx.prisma.$transaction(async (tx) => {
        await tx.teamMember.deleteMany({ where: { userId: id } });
        await tx.competitionRoster.deleteMany({ where: { userId: id } });
        await tx.applicationPlayer.deleteMany({ where: { userId: id } });
        await tx.competitionApplication.deleteMany({
          where: { applicantUserId: id },
        });
        await tx.playerCompStat.deleteMany({ where: { userId: id } });
        // See deleteShellPlayer — Restrict FK, blocks the delete otherwise.
        await tx.rosterChangePlayer.deleteMany({ where: { userId: id } });
        await tx.emailToken.deleteMany({ where: { userId: id } });
        await tx.notification.deleteMany({ where: { userId: id } });
        await tx.shellClaimRequest.deleteMany({ where: { shellUserId: id } });
        await tx.user.delete({ where: { id } });
      });
      return true;
    },
  }),
}));

// ─────────────────────────────────────────────────────────────────────────
// Round-85 — admin roster of everything the import created.
//
// Claim tokens are stored HASHED, so a claim URL can only ever be shown once,
// at creation. This screen therefore reports *state* (still a shell vs
// claimed, and by whom) and offers a re-issue for links that got lost.
// ─────────────────────────────────────────────────────────────────────────

type ShellTeamShape = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  cityName: string | null;
  memberCount: number;
  shellCount: number;
  claimedCount: number;
  createdAt: Date;
};

const ShellTeam = builder.objectRef<ShellTeamShape>("ShellTeam").implement({
  description:
    "A team imported from an offline league — i.e. one whose roster was created as shell players. `shellCount` is how many of those are still unclaimed.",
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    slug: t.exposeString("slug"),
    logoUrl: t.exposeString("logoUrl", { nullable: true }),
    cityName: t.exposeString("cityName", { nullable: true }),
    memberCount: t.exposeInt("memberCount"),
    shellCount: t.exposeInt("shellCount"),
    claimedCount: t.exposeInt("claimedCount"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

builder.queryFields((t) => ({
  shellPlayers: t.prismaField({
    type: ["User"],
    description:
      "Round-85 — every player created as an import shell: still unclaimed (isShell) or already taken over (claimedAt set). SUPER_ADMIN only.",
    args: {
      status: t.arg.string({
        description: '"UNCLAIMED" | "CLAIMED" | omit for both',
      }),
      search: t.arg.string(),
      first: t.arg.int(),
      after: t.arg.id(),
    },
    resolve: (query, _root, args, ctx) => {
      requireAdmin(ctx);
      const take = Math.min(Math.max(args.first ?? 50, 1), 100);
      const status = args.status?.toUpperCase();
      // A claimed shell has isShell:false but keeps claimedAt — that pair is
      // the only way to tell an ex-shell from an ordinary signup.
      const scope =
        status === "UNCLAIMED"
          ? { isShell: true }
          : status === "CLAIMED"
            ? { isShell: false, claimedAt: { not: null } }
            : { OR: [{ isShell: true }, { claimedAt: { not: null } }] };
      const q = args.search?.trim();
      return ctx.prisma.user.findMany({
        ...query,
        where: {
          ...scope,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { username: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take,
        ...(args.after ? { skip: 1, cursor: { id: String(args.after) } } : {}),
      });
    },
  }),

  shellTeams: t.field({
    type: [ShellTeam],
    description:
      "Round-85 — teams whose roster came from an import, i.e. any team with at least one member that is (or was) a shell. SUPER_ADMIN only.",
    args: { search: t.arg.string() },
    resolve: async (_root, args, ctx) => {
      requireAdmin(ctx);
      const q = args.search?.trim();
      const teams = await ctx.prisma.team.findMany({
        where: {
          members: {
            some: {
              user: { OR: [{ isShell: true }, { claimedAt: { not: null } }] },
            },
          },
          ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          createdAt: true,
          city: { select: { name: true } },
          members: {
            select: {
              user: { select: { isShell: true, claimedAt: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return teams.map((t2) => ({
        id: t2.id,
        name: t2.name,
        slug: t2.slug,
        logoUrl: t2.logoUrl,
        cityName: t2.city?.name ?? null,
        createdAt: t2.createdAt,
        memberCount: t2.members.length,
        shellCount: t2.members.filter((m) => m.user.isShell).length,
        claimedCount: t2.members.filter(
          (m) => !m.user.isShell && m.user.claimedAt,
        ).length,
      }));
    },
  }),
}));

builder.mutationFields((t) => ({
  reissueClaimLink: t.field({
    type: ShellClaim,
    description:
      "Round-85 — mint a fresh claim link for an unclaimed shell. The original URL is unrecoverable (tokens are hashed), so this is how a lost link is replaced. SUPER_ADMIN only.",
    args: { userId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireAdmin(ctx);
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: String(args.userId) },
        select: { id: true, name: true, username: true, isShell: true },
      });
      if (!user.isShell) {
        throw new GraphQLError(
          "That profile has already been claimed — there is nothing to claim.",
          { extensions: { code: "ALREADY_CLAIMED" } },
        );
      }
      const token = await reissueClaimToken(ctx.prisma, user.id);
      return {
        userId: user.id,
        name: user.name,
        username: user.username,
        claimUrl: buildClaimUrl(token),
      };
    },
  }),
}));

type MergeSummaryShape = {
  teamsMoved: number;
  rostersMoved: number;
  applicationsMoved: number;
  framesMoved: number;
  matchesMoved: number;
  statsMerged: number;
};

const ShellMergeResult = builder
  .objectRef<MergeSummaryShape>("ShellMergeResult")
  .implement({
    description: "What moved when a shell profile was folded into a real account.",
    fields: (t) => ({
      teamsMoved: t.exposeInt("teamsMoved"),
      rostersMoved: t.exposeInt("rostersMoved"),
      applicationsMoved: t.exposeInt("applicationsMoved"),
      framesMoved: t.exposeInt("framesMoved"),
      matchesMoved: t.exposeInt("matchesMoved"),
      statsMerged: t.exposeInt("statsMerged"),
    }),
  });

builder.mutationFields((t) => ({
  deleteShellPlayer: t.boolean({
    description:
      "Round-86 — delete an unclaimed shell created by mistake. Refuses once the shell has results attached (frames, matches, participation): deleting then would orphan them, so merge it into the real account instead. SUPER_ADMIN only.",
    args: { userId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireAdmin(ctx);
      const id = String(args.userId);
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id },
        select: { id: true, isShell: true, name: true },
      });
      if (!user.isShell) {
        throw new GraphQLError(
          "That profile has been claimed — it belongs to a real person now and can't be deleted here.",
          { extensions: { code: "NOT_A_SHELL" } },
        );
      }
      if (await shellHasHistory(ctx.prisma, id)) {
        throw new GraphQLError(
          `${user.name} has match results recorded. Merge them into the real player's account instead — deleting would orphan those results.`,
          { extensions: { code: "SHELL_HAS_HISTORY" } },
        );
      }
      const captained = await ctx.prisma.team.count({ where: { captainId: id } });
      if (captained > 0) {
        throw new GraphQLError(
          `${user.name} captains a team. Reassign the captaincy first, or merge instead.`,
          { extensions: { code: "SHELL_IS_CAPTAIN" } },
        );
      }
      // No history and no captaincy — clear the incidental rows and drop it.
      await ctx.prisma.$transaction(async (tx) => {
        await tx.teamMember.deleteMany({ where: { userId: id } });
        await tx.competitionRoster.deleteMany({ where: { userId: id } });
        await tx.applicationPlayer.deleteMany({ where: { userId: id } });
        await tx.competitionApplication.deleteMany({
          where: { applicantUserId: id },
        });
        await tx.playerCompStat.deleteMany({ where: { userId: id } });
        // RosterChangePlayer.userId is Restrict — a captain's pending proposal
        // naming this placeholder would block the delete below.
        await tx.rosterChangePlayer.deleteMany({ where: { userId: id } });
        await tx.emailToken.deleteMany({ where: { userId: id } });
        await tx.notification.deleteMany({ where: { userId: id } });
        await tx.user.delete({ where: { id } });
      });
      return true;
    },
  }),

  mergeShellIntoPlayer: t.field({
    type: ShellMergeResult,
    description:
      "Round-86 — fold a shell profile's teams, rosters, matches and stats into an existing account, then delete the shell. SUPER_ADMIN only; players merge their own via mergeClaimIntoMyAccount.",
    args: {
      shellUserId: t.arg.id({ required: true }),
      targetUserId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      requireAdmin(ctx);
      return performShellMerge(
        ctx,
        String(args.shellUserId),
        String(args.targetUserId),
      );
    },
  }),

  mergeClaimIntoMyAccount: t.field({
    type: ShellMergeResult,
    description:
      "Round-86 — the signed-in player folds the shell a claim link points at into their OWN account. This is the path for someone who already had an account before the league was imported; claimProfile (which upgrades the shell in place) only works for people who don't.",
    args: { token: t.arg.string({ required: true }) },
    resolve: async (_root, args, ctx) => {
      requireUser(ctx.viewer);
      const peek = await peekEmailToken(
        ctx.prisma,
        String(args.token),
        "CLAIM_PROFILE",
      );
      if (!peek) {
        throw new GraphQLError(
          "This claim link is invalid, expired, or already used.",
          { extensions: { code: "NOT_FOUND" } },
        );
      }
      // Round-88 — the one-placeholder-per-competition rule applies to the
      // link path too: a link can be forwarded to someone who is already in
      // that competition under their own name.
      await assertClaimEligible(ctx.prisma, peek.userId, ctx.viewer.id);
      // Read the queued self-service requests BEFORE the merge (it deletes the
      // shell row, nulling shellUserId) but close them AFTER it succeeds, so a
      // failed merge doesn't reject people for a still-unclaimed placeholder.
      const queued = await findOtherPendingClaims(ctx.prisma, peek.userId);
      const summary = await performShellMerge(ctx, peek.userId, ctx.viewer.id);
      await rejectClaims(ctx.prisma, queued, {
        note: "The profile was claimed through an organizer's claim link.",
      });
      // Single-use: burn the link so it can't be replayed against someone else.
      await consumeEmailToken(ctx.prisma, String(args.token), "CLAIM_PROFILE");
      return summary;
    },
  }),
}));

/**
 * Shared guards + recompute for both merge entry points.
 *
 * Round-88 — the guards, the standings/MVP recompute and the placeholder-team
 * cleanup moved into mergeShellIntoAccount so the self-service claim path
 * (resolvers/shell-claim.ts) can't drift from the admin one.
 */
async function performShellMerge(
  ctx: { prisma: import("@/lib/generated/prisma/client").PrismaClient },
  shellId: string,
  targetId: string,
): Promise<MergeSummaryShape> {
  return mergeShellIntoAccount(ctx.prisma, shellId, targetId);
}
