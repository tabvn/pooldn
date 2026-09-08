/**
 * Round-88 — self-service claiming of a shell (placeholder) profile.
 *
 * Shells exist so an organizer can run a competition before everyone in it has
 * a PoolDN account: the roster, the matches and the standings are all real,
 * some of the people in them are placeholders. This file is how those people
 * take their own row over without needing the secret /claim/<token> link.
 *
 * Two rules shape everything here:
 *
 *   1. One person, many placeholders. Someone who played three imported
 *      seasons has three shells; they may claim all of them. Approval MERGES
 *      the shell into their account (mergeShellIntoAccount), so every claim
 *      lands on the same id and their history accumulates.
 *
 *   2. At most ONE placeholder per competition. Two rows in a single
 *      competition is one person playing themselves — it breaks the standings
 *      table, the roster and the "already rostered" guards. So a claim is
 *      refused when the claimant is ALREADY in a competition the shell plays
 *      in, whether as themselves, via a shell they already claimed, or via
 *      another claim still awaiting review.
 */
import { GraphQLError } from "graphql";
import type { PrismaClient } from "@/lib/generated/prisma/client";

/** Application states that still hold a spot in a competition. */
const LIVE_APPLICATION_STATUSES = [
  "PENDING",
  "WAITLISTED",
  "APPROVED",
] as const;

export type CompetitionRef = {
  id: string;
  name: string;
  slug: string;
  organizerId: string;
};

/**
 * Every competition `userId` occupies a spot in — locked roster, solo entry, or
 * a still-live application roster. This is the set the one-per-competition rule
 * compares; it's deliberately wider than CompetitionRoster alone, because a
 * pending application already reserves the player (see assertNoCrossTeamRoster).
 */
export async function competitionsForUser(
  prisma: PrismaClient,
  userId: string,
): Promise<CompetitionRef[]> {
  const select = {
    id: true,
    name: true,
    slug: true,
    organizerId: true,
  } as const;
  const [rosters, soloApps, teamSlots] = await Promise.all([
    prisma.competitionRoster.findMany({
      where: { userId },
      select: { competition: { select } },
    }),
    prisma.competitionApplication.findMany({
      where: {
        applicantUserId: userId,
        status: { in: [...LIVE_APPLICATION_STATUSES] },
      },
      select: { competition: { select } },
    }),
    prisma.applicationPlayer.findMany({
      where: {
        userId,
        application: { status: { in: [...LIVE_APPLICATION_STATUSES] } },
      },
      select: { application: { select: { competition: { select } } } },
    }),
  ]);
  const byId = new Map<string, CompetitionRef>();
  for (const r of rosters) byId.set(r.competition.id, r.competition);
  for (const a of soloApps) byId.set(a.competition.id, a.competition);
  for (const s of teamSlots) {
    byId.set(s.application.competition.id, s.application.competition);
  }
  return [...byId.values()];
}

/**
 * Who may decide this claim: the organizer of every competition the shell
 * plays in, plus every admin. A shell attached to no competition yet (created
 * in a batch, not rostered) can only be reviewed by an admin — there is no
 * organizer with the standing to recognise the person.
 */
export async function claimReviewerIds(
  prisma: PrismaClient,
  shellUserId: string,
): Promise<string[]> {
  const [competitions, admins] = await Promise.all([
    competitionsForUser(prisma, shellUserId),
    prisma.user.findMany({
      where: { role: "SUPER_ADMIN", isActive: true, isShell: false },
      select: { id: true },
    }),
  ]);
  return [
    ...new Set([
      ...competitions.map((c) => c.organizerId),
      ...admins.map((a) => a.id),
    ]),
  ];
}

/** Can this viewer decide claims on this shell? */
export async function canReviewClaimFor(
  prisma: PrismaClient,
  viewer: { id: string; role: string },
  shellUserId: string | null,
): Promise<boolean> {
  if (viewer.role === "SUPER_ADMIN") return true;
  if (!shellUserId) return false;
  const competitions = await competitionsForUser(prisma, shellUserId);
  return competitions.some((c) => c.organizerId === viewer.id);
}

export type ClaimConflict = {
  competitionName: string;
  competitionSlug: string;
  /** How the claimant is already in that competition. */
  reason: "SELF" | "PENDING_CLAIM";
  /** For PENDING_CLAIM — the other placeholder they've already asked for. */
  otherShellName?: string;
};

/**
 * The one-placeholder-per-competition check. Returns every competition where
 * approving this claim would put the same person on the board twice.
 */
export async function findClaimConflicts(
  prisma: PrismaClient,
  shellUserId: string,
  requesterId: string,
): Promise<ClaimConflict[]> {
  const [shellComps, requesterComps] = await Promise.all([
    competitionsForUser(prisma, shellUserId),
    competitionsForUser(prisma, requesterId),
  ]);
  if (shellComps.length === 0) return [];
  const shellCompIds = new Set(shellComps.map((c) => c.id));
  const conflicts: ClaimConflict[] = [];

  for (const c of requesterComps) {
    if (shellCompIds.has(c.id)) {
      conflicts.push({
        competitionName: c.name,
        competitionSlug: c.slug,
        reason: "SELF",
      });
    }
  }

  // A claim still awaiting review reserves its competitions too — otherwise
  // someone could file two requests on two shells in one competition and have
  // both approved by different organizers.
  const pending = await prisma.shellClaimRequest.findMany({
    where: {
      requesterId,
      status: "PENDING",
      shellUserId: { not: null, notIn: [shellUserId] },
    },
    select: { shellUserId: true, shellName: true },
  });
  for (const p of pending) {
    if (!p.shellUserId) continue;
    const otherComps = await competitionsForUser(prisma, p.shellUserId);
    for (const c of otherComps) {
      if (!shellCompIds.has(c.id)) continue;
      if (conflicts.some((x) => x.competitionSlug === c.slug)) continue;
      conflicts.push({
        competitionName: c.name,
        competitionSlug: c.slug,
        reason: "PENDING_CLAIM",
        otherShellName: p.shellName,
      });
    }
  }
  return conflicts;
}

/** Human-readable version of the conflicts, for the error the claimant sees. */
export function conflictMessage(
  shellName: string,
  conflicts: ClaimConflict[],
): string {
  const first = conflicts[0];
  const rest =
    conflicts.length > 1
      ? ` (and ${conflicts.length - 1} more competition${conflicts.length > 2 ? "s" : ""})`
      : "";
  if (first.reason === "PENDING_CLAIM") {
    return `You've already asked to claim ${first.otherShellName} in ${first.competitionName}${rest}. A player can only hold one profile per competition — cancel that request first if ${shellName} is the right one.`;
  }
  return `You're already in ${first.competitionName}${rest} under your own account, so ${shellName} can't also be you there. A player can only hold one profile per competition.`;
}

/**
 * Everything that must be true before a claim can be filed OR approved.
 * Re-run at approval time: rosters and other claims move while a request sits
 * in the queue.
 */
export async function assertClaimEligible(
  prisma: PrismaClient,
  shellUserId: string,
  requesterId: string,
): Promise<{ shellName: string; shellUsername: string }> {
  if (shellUserId === requesterId) {
    throw new GraphQLError("That's your own profile.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const [shell, requester] = await Promise.all([
    prisma.user.findUnique({
      where: { id: shellUserId },
      select: { id: true, name: true, username: true, isShell: true },
    }),
    prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true, isShell: true, bannedAt: true },
    }),
  ]);
  if (!shell) {
    throw new GraphQLError("That profile no longer exists.", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (!shell.isShell) {
    throw new GraphQLError(
      `${shell.name} has already been claimed — it belongs to a real account now.`,
      { extensions: { code: "ALREADY_CLAIMED" } },
    );
  }
  if (!requester || requester.isShell || requester.bannedAt) {
    throw new GraphQLError("Your account can't claim a profile.", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  const conflicts = await findClaimConflicts(prisma, shellUserId, requesterId);
  if (conflicts.length > 0) {
    throw new GraphQLError(conflictMessage(shell.name, conflicts), {
      extensions: { code: "ONE_PROFILE_PER_COMPETITION", conflicts },
    });
  }
  return { shellName: shell.name, shellUsername: shell.username };
}

/**
 * A team stops being a placeholder once every one of its members is a real
 * account. Call after any claim lands, with the teams the claimed shell was on.
 *
 * Only ever CLEARS the flag. `Team.isShell` means "created as a placeholder",
 * not "currently has a placeholder on the roster" — a real team that adds one
 * missing player as a placeholder is still a real team.
 */
export async function refreshShellTeamFlags(
  prisma: PrismaClient,
  teamIds: string[],
): Promise<void> {
  for (const teamId of new Set(teamIds)) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, isShell: true, captain: { select: { isShell: true } } },
    });
    if (!team?.isShell) continue;
    if (team.captain.isShell) continue;
    // isActive matters: Team.shellMemberCount (types/team.ts) counts only
    // active members, so a placeholder who has LEFT the roster would otherwise
    // keep the team badged "Placeholder team · 0 unclaimed" forever.
    const remaining = await prisma.teamMember.count({
      where: { teamId, isActive: true, user: { isShell: true } },
    });
    if (remaining > 0) continue;
    await prisma.team.update({ where: { id: teamId }, data: { isShell: false } });
  }
}

/** Team ids a (still-existing) shell belongs to — read BEFORE a merge. */
export async function teamIdsForUser(
  prisma: PrismaClient,
  userId: string,
): Promise<string[]> {
  const [memberships, captaincies] = await Promise.all([
    prisma.teamMember.findMany({ where: { userId }, select: { teamId: true } }),
    prisma.team.findMany({ where: { captainId: userId }, select: { id: true } }),
  ]);
  return [
    ...new Set([
      ...memberships.map((m) => m.teamId),
      ...captaincies.map((t) => t.id),
    ]),
  ];
}

export type PendingClaim = {
  id: string;
  requesterId: string;
  shellName: string;
};

/**
 * The other requests queued against a shell. Read these BEFORE a merge — the
 * merge deletes the shell row, which nulls `shellUserId` and makes them
 * unfindable by shell afterwards.
 */
export async function findOtherPendingClaims(
  prisma: PrismaClient,
  shellUserId: string,
  exceptId?: string,
): Promise<PendingClaim[]> {
  return prisma.shellClaimRequest.findMany({
    where: {
      shellUserId,
      status: "PENDING",
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true, requesterId: true, shellName: true },
  });
}

/**
 * Close out requests on a shell that has just been taken over — by an approval
 * or by someone using a claim link. Nothing is left to claim, so the losers are
 * rejected with a note rather than left pending forever.
 *
 * Takes ids rather than a shell id so the caller can read the list before the
 * merge and only reject AFTER it succeeds: rejecting first meant a merge that
 * threw left those people rejected for a placeholder still sitting unclaimed.
 */
export async function rejectClaims(
  prisma: PrismaClient,
  claims: PendingClaim[],
  opts: { note: string; reviewedById?: string | null },
): Promise<PendingClaim[]> {
  if (claims.length === 0) return [];
  await prisma.shellClaimRequest.updateMany({
    where: { id: { in: claims.map((c) => c.id) } },
    data: {
      status: "REJECTED",
      reviewNote: opts.note,
      reviewedById: opts.reviewedById ?? null,
      reviewedAt: new Date(),
    },
  });
  return claims;
}
