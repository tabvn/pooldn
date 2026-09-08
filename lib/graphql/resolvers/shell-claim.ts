import { GraphQLError } from "graphql";
import { builder } from "../builder";
import { requireUser } from "@/lib/casl/guard";
import { ShellClaimStatus } from "@/lib/generated/prisma/enums";
import { NotificationService } from "@/lib/services/notification.service";
import { mergeShellIntoAccount } from "@/lib/services/shell-merge.service";
import {
  assertClaimEligible,
  canReviewClaimFor,
  claimReviewerIds,
  competitionsForUser,
  conflictMessage,
  findClaimConflicts,
  findOtherPendingClaims,
  rejectClaims,
} from "@/lib/services/shell-claim.service";

/**
 * Round-88 — the self-service side of shell profiles.
 *
 * A shell is a placeholder an organizer created so a competition could run
 * before everyone in it had an account. Anyone signed in can point at one and
 * say "that's me"; an organizer of a competition the shell plays in — or an
 * admin — approves, and approval merges the placeholder into their account.
 *
 * The claim LINK (/claim/<token>, resolvers/claim.ts) still exists and skips
 * review; this is the path for people who never got one.
 */

export const ShellClaimStatusEnum = builder.enumType(ShellClaimStatus, {
  name: "ShellClaimStatus",
});

type ClaimCompetitionShape = {
  id: string;
  name: string;
  slug: string;
};

const ClaimCompetition = builder
  .objectRef<ClaimCompetitionShape>("ShellClaimCompetition")
  .implement({
    description:
      "A competition the placeholder plays in — the context a reviewer needs to recognise the person, and the scope of the one-profile-per-competition rule.",
    fields: (t) => ({
      id: t.exposeID("id"),
      name: t.exposeString("name"),
      slug: t.exposeString("slug"),
    }),
  });

builder.prismaObject("ShellClaimRequest", {
  description:
    "A signed-in player asking to take over a shell (placeholder) profile, awaiting an organizer's or admin's decision.",
  fields: (t) => ({
    id: t.exposeID("id"),
    // Null once the claim is approved: approving merges the placeholder away.
    // shellName / shellUsername are the copies kept for exactly that moment.
    shellUser: t.relation("shellUser", { nullable: true }),
    shellName: t.exposeString("shellName"),
    shellUsername: t.exposeString("shellUsername"),
    requester: t.relation("requester"),
    status: t.expose("status", { type: ShellClaimStatusEnum }),
    message: t.exposeString("message", { nullable: true }),
    reviewNote: t.exposeString("reviewNote", { nullable: true }),
    reviewedBy: t.relation("reviewedBy", { nullable: true }),
    reviewedAt: t.expose("reviewedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    competitions: t.field({
      type: [ClaimCompetition],
      description:
        "Competitions the placeholder plays in. Empty once the claim is approved (the placeholder is gone) or if it was never rostered.",
      resolve: async (r, _args, ctx) => {
        if (!r.shellUserId) return [];
        const comps = await competitionsForUser(ctx.prisma, r.shellUserId);
        return comps.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
      },
    }),
    viewerCanReview: t.boolean({
      description:
        "Whether the viewer may approve or reject this request (organizer of one of the placeholder's competitions, or admin — and never their own request).",
      resolve: async (r, _args, ctx) => {
        if (!ctx.viewer) return false;
        // Nobody confirms their own identity claim, admin or not.
        if (r.requesterId === ctx.viewer.id) return false;
        return canReviewClaimFor(ctx.prisma, ctx.viewer, r.shellUserId);
      },
    }),
  }),
});

// ─────────────────────────────────────────────────────────────────────────
// Viewer-context fields on User, so the profile screen can render the claim
// panel from one query: is this claimable by me, and did I already ask?
// ─────────────────────────────────────────────────────────────────────────

builder.prismaObjectFields("User", (t) => ({
  myShellClaim: t.prismaField({
    type: "ShellClaimRequest",
    nullable: true,
    description:
      "The viewer's most recent claim request on this profile, if any. Drives the 'waiting for review' / 'not approved' states on the claim panel.",
    resolve: (query, u, _args, ctx) => {
      if (!ctx.viewer) return null;
      return ctx.prisma.shellClaimRequest.findFirst({
        ...query,
        where: { shellUserId: u.id, requesterId: ctx.viewer.id },
        orderBy: { createdAt: "desc" },
      });
    },
  }),
  viewerCanClaim: t.boolean({
    description:
      "True when the viewer could file a claim on this profile right now — signed in, this row is still a placeholder, no request outstanding, and no competition where they'd end up playing themselves.",
    resolve: async (u, _args, ctx) => {
      if (!ctx.viewer || !u.isShell || ctx.viewer.id === u.id) return false;
      const pending = await ctx.prisma.shellClaimRequest.count({
        where: {
          shellUserId: u.id,
          requesterId: ctx.viewer.id,
          status: "PENDING",
        },
      });
      if (pending > 0) return false;
      const conflicts = await findClaimConflicts(
        ctx.prisma,
        u.id,
        ctx.viewer.id,
      );
      return conflicts.length === 0;
    },
  }),
  claimBlockedReason: t.string({
    nullable: true,
    description:
      "Why the viewer can't claim this placeholder, phrased for them. Null when they can (or when claiming doesn't apply at all).",
    resolve: async (u, _args, ctx) => {
      if (!ctx.viewer || !u.isShell || ctx.viewer.id === u.id) return null;
      const conflicts = await findClaimConflicts(
        ctx.prisma,
        u.id,
        ctx.viewer.id,
      );
      if (conflicts.length === 0) return null;
      return conflictMessage(u.name, conflicts);
    },
  }),
  pendingClaimCount: t.int({
    description:
      "How many people have asked to claim this placeholder. Only meaningful to a reviewer; 0 for everyone else.",
    resolve: async (u, _args, ctx) => {
      if (!ctx.viewer) return 0;
      const allowed = await canReviewClaimFor(ctx.prisma, ctx.viewer, u.id);
      if (!allowed) return 0;
      return ctx.prisma.shellClaimRequest.count({
        // Their own request isn't theirs to review, so it doesn't belong in
        // the "N people asked, go decide" nudge either.
        where: {
          shellUserId: u.id,
          status: "PENDING",
          requesterId: { not: ctx.viewer.id },
        },
      });
    },
  }),
}));

builder.prismaObjectFields("Competition", (t) => ({
  shellPlayerCount: t.int({
    description:
      "Players in this competition that are still unclaimed placeholders.",
    resolve: async (c, _args, ctx) => {
      const ids = await shellIdsInCompetition(ctx.prisma, c.id);
      if (ids.length === 0) return 0;
      return ctx.prisma.user.count({
        where: { id: { in: ids }, isShell: true },
      });
    },
  }),
  pendingClaimCount: t.int({
    description:
      "Claim requests on this competition's placeholders that are waiting on a decision. 0 for anyone who can't review them (i.e. not the organizer or an admin).",
    resolve: async (c, _args, ctx) => {
      if (!ctx.viewer) return 0;
      const canReview =
        ctx.viewer.role === "SUPER_ADMIN" || ctx.viewer.id === c.organizerId;
      if (!canReview) return 0;
      const ids = await shellIdsInCompetition(ctx.prisma, c.id);
      if (ids.length === 0) return 0;
      return ctx.prisma.shellClaimRequest.count({
        where: { shellUserId: { in: ids }, status: "PENDING" },
      });
    },
  }),
}));

/** The placeholder user ids taking part in one competition. */
async function shellIdsInCompetition(
  prisma: import("@/lib/generated/prisma/client").PrismaClient,
  competitionId: string,
): Promise<string[]> {
  const [rosters, soloApps, slots] = await Promise.all([
    prisma.competitionRoster.findMany({
      where: { competitionId },
      select: { userId: true },
    }),
    prisma.competitionApplication.findMany({
      where: {
        competitionId,
        applicantUserId: { not: null },
        status: { in: ["PENDING", "WAITLISTED", "APPROVED"] },
      },
      select: { applicantUserId: true },
    }),
    prisma.applicationPlayer.findMany({
      where: {
        application: {
          competitionId,
          status: { in: ["PENDING", "WAITLISTED", "APPROVED"] },
        },
      },
      select: { userId: true },
    }),
  ]);
  return [
    ...new Set([
      ...rosters.map((r) => r.userId),
      ...soloApps.flatMap((a) => (a.applicantUserId ? [a.applicantUserId] : [])),
      ...slots.map((s) => s.userId),
    ]),
  ];
}

/**
 * Scope a reviewer's queue. An admin sees every request; an organizer sees
 * only requests on placeholders that play in a competition they run — the
 * same standing that lets them decide it.
 */
async function reviewableWhere(ctx: {
  prisma: import("@/lib/generated/prisma/client").PrismaClient;
  viewer: { id: string; role: string } | null;
}) {
  requireUser(ctx.viewer);
  if (ctx.viewer.role === "SUPER_ADMIN") return {};
  const mine = await ctx.prisma.competition.findMany({
    where: { organizerId: ctx.viewer.id },
    select: { id: true },
  });
  if (mine.length === 0) {
    // No competitions, no queue. `in: []` is the empty result, not "all".
    return { id: { in: [] as string[] } };
  }
  const shellIds = new Set<string>();
  for (const c of mine) {
    for (const id of await shellIdsInCompetition(ctx.prisma, c.id)) {
      shellIds.add(id);
    }
  }
  return { shellUserId: { in: [...shellIds] } };
}

builder.queryFields((t) => ({
  shellClaimRequests: t.prismaField({
    type: ["ShellClaimRequest"],
    description:
      "The viewer's claim-review queue: every request an admin can decide, or — for an organizer — the requests on placeholders playing in a competition they run. Newest first.",
    args: {
      status: t.arg({ type: ShellClaimStatusEnum }),
      competitionId: t.arg.id({
        description: "Scope to placeholders taking part in this competition.",
      }),
      first: t.arg.int(),
    },
    resolve: async (query, _root, args, ctx) => {
      const scope = await reviewableWhere(ctx);
      const byCompetition = args.competitionId
        ? {
            shellUserId: {
              in: await shellIdsInCompetition(
                ctx.prisma,
                String(args.competitionId),
              ),
            },
          }
        : {};
      return ctx.prisma.shellClaimRequest.findMany({
        ...query,
        where: {
          AND: [
            scope,
            byCompetition,
            args.status ? { status: args.status } : {},
          ],
        },
        orderBy: [{ createdAt: "desc" }],
        take: Math.min(Math.max(args.first ?? 50, 1), 200),
      });
    },
  }),

  pendingShellClaimCount: t.int({
    description:
      "How many claim requests are waiting on the viewer, optionally scoped to one competition. 0 for anyone who can't review.",
    args: { competitionId: t.arg.id() },
    resolve: async (_root, args, ctx) => {
      if (!ctx.viewer) return 0;
      const scope = await reviewableWhere(ctx);
      const byCompetition = args.competitionId
        ? {
            shellUserId: {
              in: await shellIdsInCompetition(
                ctx.prisma,
                String(args.competitionId),
              ),
            },
          }
        : {};
      return ctx.prisma.shellClaimRequest.count({
        where: { AND: [scope, byCompetition, { status: "PENDING" }] },
      });
    },
  }),

  myShellClaims: t.prismaField({
    type: ["ShellClaimRequest"],
    description:
      "Claim requests the viewer has filed, newest first. Empty for guests.",
    resolve: (query, _root, _args, ctx) => {
      if (!ctx.viewer) return [];
      return ctx.prisma.shellClaimRequest.findMany({
        ...query,
        where: { requesterId: ctx.viewer.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    },
  }),
}));

builder.mutationFields((t) => ({
  requestShellClaim: t.prismaField({
    type: "ShellClaimRequest",
    description:
      "Ask to take over a shell (placeholder) profile. Goes to the organizers of the competitions that placeholder plays in, plus admins. Refused if the viewer is already in one of those competitions — one profile per competition.",
    args: {
      shellUserId: t.arg.id({ required: true }),
      message: t.arg.string({
        description:
          "Optional note to the organizer — how they can tell it's you.",
      }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const shellUserId = String(args.shellUserId);
      const { shellName, shellUsername } = await assertClaimEligible(
        ctx.prisma,
        shellUserId,
        ctx.viewer.id,
      );
      const existing = await ctx.prisma.shellClaimRequest.findFirst({
        where: {
          shellUserId,
          requesterId: ctx.viewer.id,
          status: "PENDING",
        },
        select: { id: true },
      });
      if (existing) {
        throw new GraphQLError(
          `You've already asked to claim ${shellName}. An organizer will review it.`,
          { extensions: { code: "CLAIM_ALREADY_PENDING" } },
        );
      }
      const request = await ctx.prisma.shellClaimRequest.create({
        data: {
          shellUserId,
          shellName,
          shellUsername,
          requesterId: ctx.viewer.id,
          message: args.message?.trim() || null,
        },
      });

      const reviewers = await claimReviewerIds(ctx.prisma, shellUserId);
      const requester = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.viewer.id },
        select: { name: true, username: true },
      });
      await new NotificationService(ctx.prisma).create({
        type: "SHELL_CLAIM_REQUESTED",
        title: `${requester.name} says they're ${shellName}`,
        message: `${requester.name} (@${requester.username}) asked to claim the placeholder profile ${shellName}. Approve it to hand over that player's history, or reject it.`,
        recipients: reviewers,
        entity: { type: "USER", id: shellUserId, slug: shellUsername },
        groupKey: `shell-claim-${request.id}`,
      });

      return ctx.prisma.shellClaimRequest.findUniqueOrThrow({
        ...query,
        where: { id: request.id },
      });
    },
  }),

  cancelShellClaim: t.prismaField({
    type: "ShellClaimRequest",
    description: "Withdraw your own claim request while it's still pending.",
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const request = await ctx.prisma.shellClaimRequest.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      if (request.requesterId !== ctx.viewer.id) {
        throw new GraphQLError("That isn't your request.", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      if (request.status !== "PENDING") {
        throw new GraphQLError("That request has already been reviewed.", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      return ctx.prisma.shellClaimRequest.update({
        ...query,
        where: { id: request.id },
        data: { status: "CANCELLED" },
      });
    },
  }),

  reviewShellClaim: t.prismaField({
    type: "ShellClaimRequest",
    description:
      "Organizer/admin decision on a claim request. Approving MERGES the placeholder into the claimant's account — every match, roster spot and stat moves, and the placeholder is removed; standings and MVP recompute. Rejecting leaves the placeholder in place.",
    args: {
      id: t.arg.id({ required: true }),
      approve: t.arg.boolean({ required: true }),
      note: t.arg.string({
        description: "Shown to the claimant with the decision.",
      }),
    },
    resolve: async (query, _root, args, ctx) => {
      requireUser(ctx.viewer);
      const request = await ctx.prisma.shellClaimRequest.findUniqueOrThrow({
        where: { id: String(args.id) },
      });
      if (request.status !== "PENDING") {
        throw new GraphQLError("That request has already been reviewed.", {
          extensions: { code: "INVALID_TRANSITION" },
        });
      }
      if (request.requesterId === ctx.viewer.id) {
        throw new GraphQLError(
          "You can't confirm your own claim — another organizer or an admin has to.",
          { extensions: { code: "FORBIDDEN" } },
        );
      }
      const allowed = await canReviewClaimFor(
        ctx.prisma,
        ctx.viewer,
        request.shellUserId,
      );
      if (!allowed) {
        throw new GraphQLError(
          "Only an organizer of a competition this player is in — or an admin — can decide this.",
          { extensions: { code: "FORBIDDEN" } },
        );
      }
      const note = args.note?.trim() || null;
      const svc = new NotificationService(ctx.prisma);

      if (!args.approve) {
        const rejected = await ctx.prisma.shellClaimRequest.update({
          ...query,
          where: { id: request.id },
          data: {
            status: "REJECTED",
            reviewNote: note,
            reviewedById: ctx.viewer.id,
            reviewedAt: new Date(),
          },
        });
        await svc.create({
          type: "SHELL_CLAIM_REJECTED",
          title: `Your claim on ${request.shellName} wasn't approved`,
          message:
            note ??
            `The organizer didn't approve your request to claim ${request.shellName}. Get in touch with them if you think that's a mistake.`,
          recipients: [request.requesterId],
          entity: request.shellUserId
            ? {
                type: "USER",
                id: request.shellUserId,
                slug: request.shellUsername,
              }
            : undefined,
          groupKey: `shell-claim-${request.id}`,
        });
        return rejected;
      }

      if (!request.shellUserId) {
        throw new GraphQLError(
          `${request.shellName} no longer exists — the profile was claimed or removed.`,
          { extensions: { code: "NOT_FOUND" } },
        );
      }
      const shellUserId = request.shellUserId;
      // Re-check: rosters and other claims move while a request waits.
      await assertClaimEligible(ctx.prisma, shellUserId, request.requesterId);

      // Everyone else who asked for this placeholder loses — but only once the
      // merge actually lands. Read them first (the merge deletes the shell,
      // which nulls shellUserId and would hide them), reject after: a merge
      // that throws must not leave other people rejected for a placeholder
      // that is still sitting there unclaimed.
      const losers = await findOtherPendingClaims(
        ctx.prisma,
        shellUserId,
        request.id,
      );

      await mergeShellIntoAccount(
        ctx.prisma,
        shellUserId,
        request.requesterId,
      );

      await rejectClaims(ctx.prisma, losers, {
        note: `${request.shellName} was claimed by someone else.`,
        reviewedById: ctx.viewer.id,
      });

      const approved = await ctx.prisma.shellClaimRequest.update({
        ...query,
        where: { id: request.id },
        data: {
          status: "APPROVED",
          reviewNote: note,
          reviewedById: ctx.viewer.id,
          reviewedAt: new Date(),
        },
      });
      const claimant = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: request.requesterId },
        select: { username: true },
      });
      await svc.create({
        type: "SHELL_CLAIM_APPROVED",
        title: `${request.shellName} is yours`,
        message:
          note ??
          `Your claim was approved — every match, roster spot and stat recorded for ${request.shellName} is now on your profile.`,
        recipients: [request.requesterId],
        entity: {
          type: "USER",
          id: request.requesterId,
          slug: claimant.username,
        },
        groupKey: `shell-claim-${request.id}`,
      });
      if (losers.length > 0) {
        await svc.create({
          type: "SHELL_CLAIM_REJECTED",
          title: `${request.shellName} has been claimed`,
          message: `Someone else's claim on ${request.shellName} was approved, so your request was closed. Talk to the competition organizer if that profile is you.`,
          recipients: losers.map((l) => l.requesterId),
        });
      }
      return approved;
    },
  }),
}));
