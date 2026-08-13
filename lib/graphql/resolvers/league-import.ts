import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { requireUser } from "@/lib/casl/guard";
import { createShellUser, buildClaimUrl } from "@/lib/services/shell.service";

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
      "Admin — create a shell team (with a shell captain), roster it into a competition as an APPROVED entry, and return a claim link per player. Enter that team's matches/results afterward via the normal staff flow.",
    args: { input: t.arg({ type: ImportLeagueTeamInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      requireAdmin(ctx);
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
        select: { id: true, type: true },
      });
      if (!competition) {
        throw new GraphQLError("Competition not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
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
        claimToken: string;
        isCaptain: boolean;
      }> = [];
      for (const p of players) {
        const { user, claimToken } = await createShellUser(ctx.prisma, {
          name: p.name,
          cityId: input.cityId ? String(input.cityId) : null,
        });
        created.push({
          userId: user.id,
          name: user.name,
          username: user.username,
          claimToken,
          isCaptain: p.isCaptain,
        });
      }
      const captain = created.find((c) => c.isCaptain)!;

      const team = await ctx.prisma.$transaction(async (tx) => {
        const t2 = await tx.team.create({
          data: {
            name: input.name.trim(),
            slug,
            captainId: captain.userId,
            cityId: input.cityId ? String(input.cityId) : null,
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
