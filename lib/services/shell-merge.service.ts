/**
 * Round-86 — merging a shell profile into an existing real account, and
 * deleting a shell that was created by mistake.
 *
 * Claiming (see resolvers/claim.ts) upgrades the shell row IN PLACE, so the id
 * is preserved and every match, roster spot and stat it owns simply becomes
 * the real account's. That only works when the person does NOT already have an
 * account. When they do, the two rows have to be reconciled — which is this
 * file, and which is why the claim flow used to dead-end at "contact the
 * league organizer to link your history".
 *
 * Everything the import can attach to a shell is moved. Rows carrying a unique
 * constraint that the target already satisfies are merged rather than moved:
 * counters are summed (PlayerCompStat, MatchParticipant) and duplicates are
 * dropped (team membership, roster spot, application slot).
 */
import { GraphQLError } from "graphql";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { recomputeMvp, recomputeStandings } from "./standings.service";
import {
  competitionsForUser,
  refreshShellTeamFlags,
  teamIdsForUser,
} from "./shell-claim.service";

export type MergeSummary = {
  teamsMoved: number;
  rostersMoved: number;
  applicationsMoved: number;
  framesMoved: number;
  matchesMoved: number;
  statsMerged: number;
};

/**
 * Does this shell have results attached? Deleting one that does would orphan
 * frames and standings, so the admin screen refuses and offers merge instead.
 */
export async function shellHasHistory(
  prisma: PrismaClient,
  userId: string,
): Promise<boolean> {
  const [frames, singles, participants, stats] = await Promise.all([
    prisma.matchFrame.count({
      where: { OR: [{ homePlayerId: userId }, { awayPlayerId: userId }] },
    }),
    prisma.match.count({
      where: { OR: [{ homePlayerId: userId }, { awayPlayerId: userId }] },
    }),
    prisma.matchParticipant.count({ where: { userId } }),
    prisma.playerCompStat.count({
      where: { userId, OR: [{ matchesPlayed: { gt: 0 } }, { framesPlayed: { gt: 0 } }] },
    }),
  ]);
  return frames + singles + participants + stats > 0;
}

/**
 * Fold `shellId` into `targetId`. Runs in one transaction: either the whole
 * profile moves or nothing does — a half-merged player would show up twice in
 * a standings table.
 */
export async function mergeShellIntoUser(
  prisma: PrismaClient,
  shellId: string,
  targetId: string,
): Promise<MergeSummary> {
  // Display names, for the denormalised labels below. Read outside the
  // transaction because the shell row is deleted inside it.
  const [shellUser, targetUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: shellId },
      select: { name: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: targetId },
      select: { name: true },
    }),
  ]);

  return prisma.$transaction(async (tx) => {
    const summary: MergeSummary = {
      teamsMoved: 0,
      rostersMoved: 0,
      applicationsMoved: 0,
      framesMoved: 0,
      matchesMoved: 0,
      statsMerged: 0,
    };

    // ── Team membership — @@unique([teamId, userId]) ─────────────────────
    const memberships = await tx.teamMember.findMany({
      where: { userId: shellId },
      select: { id: true, teamId: true },
    });
    for (const m of memberships) {
      const existing = await tx.teamMember.findUnique({
        where: { teamId_userId: { teamId: m.teamId, userId: targetId } },
        select: { id: true },
      });
      if (existing) {
        await tx.teamMember.delete({ where: { id: m.id } });
      } else {
        await tx.teamMember.update({
          where: { id: m.id },
          data: { userId: targetId },
        });
        summary.teamsMoved += 1;
      }
    }
    // Captaincy has no unique constraint — a straight reassign.
    await tx.team.updateMany({
      where: { captainId: shellId },
      data: { captainId: targetId },
    });

    // ── Competition roster — @@unique([competitionId, userId]) ───────────
    const rosters = await tx.competitionRoster.findMany({
      where: { userId: shellId },
      select: { id: true, competitionId: true },
    });
    for (const r of rosters) {
      const existing = await tx.competitionRoster.findUnique({
        where: {
          competitionId_userId: {
            competitionId: r.competitionId,
            userId: targetId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        await tx.competitionRoster.delete({ where: { id: r.id } });
      } else {
        await tx.competitionRoster.update({
          where: { id: r.id },
          data: { userId: targetId },
        });
        summary.rostersMoved += 1;
      }
    }

    // ── Solo applications — @@unique([competitionId, applicantUserId]) ───
    const apps = await tx.competitionApplication.findMany({
      where: { applicantUserId: shellId },
      select: { id: true, competitionId: true },
    });
    for (const a of apps) {
      const existing = await tx.competitionApplication.findUnique({
        where: {
          competitionId_applicantUserId: {
            competitionId: a.competitionId,
            applicantUserId: targetId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        await tx.competitionApplication.delete({ where: { id: a.id } });
      } else {
        await tx.competitionApplication.update({
          where: { id: a.id },
          data: { applicantUserId: targetId },
        });
        summary.applicationsMoved += 1;
      }
    }
    await tx.competitionApplication.updateMany({
      where: { rosterCaptainUserId: shellId },
      data: { rosterCaptainUserId: targetId },
    });

    // ── Application roster slots — @@unique([applicationId, userId]) ─────
    const slots = await tx.applicationPlayer.findMany({
      where: { userId: shellId },
      select: { id: true, applicationId: true },
    });
    for (const s of slots) {
      const existing = await tx.applicationPlayer.findUnique({
        where: {
          applicationId_userId: {
            applicationId: s.applicationId,
            userId: targetId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        await tx.applicationPlayer.delete({ where: { id: s.id } });
      } else {
        // `name` is a denormalised copy taken at submission time. Nothing
        // renders it today (the UI reads the relation), but leaving the
        // placeholder's name on a row that now belongs to someone else is
        // exactly the kind of thing that resurfaces later.
        await tx.applicationPlayer.update({
          where: { id: s.id },
          data: { userId: targetId, name: targetUser.name },
        });
      }
    }

    // ── Results. No unique constraints here, so a plain reassign. ────────
    //
    // MatchFrame also carries FREE-TEXT labels (homePlayer/awayPlayer) written
    // at lineup submission — "A & B" for a doubles couple. The lineup UI
    // prefers that string over the linked player for doubles, so without
    // rewriting it an old doubles frame would keep showing the placeholder's
    // name after the merge. Capture the rows before reassigning, since the
    // shell id is what identifies them.
    const labelled = await tx.matchFrame.findMany({
      where: { OR: [{ homePlayerId: shellId }, { awayPlayerId: shellId }] },
      select: {
        id: true,
        homePlayerId: true,
        awayPlayerId: true,
        homePlayer: true,
        awayPlayer: true,
      },
    });

    const homeFrames = await tx.matchFrame.updateMany({
      where: { homePlayerId: shellId },
      data: { homePlayerId: targetId },
    });
    const awayFrames = await tx.matchFrame.updateMany({
      where: { awayPlayerId: shellId },
      data: { awayPlayerId: targetId },
    });
    summary.framesMoved = homeFrames.count + awayFrames.count;

    const swapName = (label: string | null) =>
      label && shellUser.name && label.includes(shellUser.name)
        ? label.split(shellUser.name).join(targetUser.name)
        : null;
    for (const f of labelled) {
      const nextHome =
        f.homePlayerId === shellId ? swapName(f.homePlayer) : null;
      const nextAway =
        f.awayPlayerId === shellId ? swapName(f.awayPlayer) : null;
      if (nextHome === null && nextAway === null) continue;
      await tx.matchFrame.update({
        where: { id: f.id },
        data: {
          ...(nextHome !== null ? { homePlayer: nextHome } : {}),
          ...(nextAway !== null ? { awayPlayer: nextAway } : {}),
        },
      });
    }

    const homeMatches = await tx.match.updateMany({
      where: { homePlayerId: shellId },
      data: { homePlayerId: targetId },
    });
    const awayMatches = await tx.match.updateMany({
      where: { awayPlayerId: shellId },
      data: { awayPlayerId: targetId },
    });
    summary.matchesMoved = homeMatches.count + awayMatches.count;

    // ── Per-match participation — @@unique([matchId, userId]); sum ───────
    const parts = await tx.matchParticipant.findMany({
      where: { userId: shellId },
    });
    for (const p of parts) {
      const existing = await tx.matchParticipant.findUnique({
        where: { matchId_userId: { matchId: p.matchId, userId: targetId } },
      });
      if (existing) {
        await tx.matchParticipant.update({
          where: { id: existing.id },
          data: {
            framesWon: existing.framesWon + p.framesWon,
            framesPlayed: existing.framesPlayed + p.framesPlayed,
          },
        });
        await tx.matchParticipant.delete({ where: { id: p.id } });
      } else {
        await tx.matchParticipant.update({
          where: { id: p.id },
          data: { userId: targetId },
        });
      }
    }

    // ── Per-competition stats — @@unique([competitionId, userId]); sum ───
    // These are derived (recomputeStandings/recomputeMvp rebuild them), but
    // summing keeps the table correct until the next recompute rather than
    // briefly halving someone's record.
    const stats = await tx.playerCompStat.findMany({
      where: { userId: shellId },
    });
    for (const st of stats) {
      const existing = await tx.playerCompStat.findUnique({
        where: {
          competitionId_userId: {
            competitionId: st.competitionId,
            userId: targetId,
          },
        },
      });
      if (existing) {
        await tx.playerCompStat.update({
          where: { id: existing.id },
          data: {
            matchesPlayed: existing.matchesPlayed + st.matchesPlayed,
            framesPlayed: existing.framesPlayed + st.framesPlayed,
            framesWon: existing.framesWon + st.framesWon,
            mvpScore: existing.mvpScore + st.mvpScore,
            isMvp: existing.isMvp || st.isMvp,
          },
        });
        await tx.playerCompStat.delete({ where: { id: st.id } });
      } else {
        await tx.playerCompStat.update({
          where: { id: st.id },
          data: { userId: targetId },
        });
      }
      summary.statsMerged += 1;
    }

    // ── Roster-change proposals — @@unique([requestId, userId]) ─────────
    // RosterChangePlayer.userId is a REQUIRED relation with no onDelete, i.e.
    // Restrict: leaving a single row behind makes the `user.delete` at the end
    // of this transaction fail and rolls the whole merge back with an opaque
    // error. A captain proposing to add or drop a placeholder is enough to
    // create one.
    const proposals = await tx.rosterChangePlayer.findMany({
      where: { userId: shellId },
      select: { id: true, requestId: true },
    });
    for (const rp of proposals) {
      const existing = await tx.rosterChangePlayer.findUnique({
        where: {
          requestId_userId: { requestId: rp.requestId, userId: targetId },
        },
        select: { id: true },
      });
      if (existing) {
        await tx.rosterChangePlayer.delete({ where: { id: rp.id } });
      } else {
        await tx.rosterChangePlayer.update({
          where: { id: rp.id },
          data: { userId: targetId },
        });
      }
    }
    await tx.rosterChangeRequest.updateMany({
      where: { requestedById: shellId },
      data: { requestedById: targetId },
    });
    await tx.rosterChangeRequest.updateMany({
      where: { reviewedById: shellId },
      data: { reviewedById: targetId },
    });

    // ── Score submissions + the application thread ───────────────────────
    // submittedById is @@unique([matchId, submittedById]); a shell can't sign
    // in, so it can only own a row a staff member entered on its behalf —
    // still, guard the collision.
    const subs = await tx.matchScoreSubmission.findMany({
      where: { submittedById: shellId },
      select: { id: true, matchId: true },
    });
    for (const sub of subs) {
      const existing = await tx.matchScoreSubmission.findUnique({
        where: {
          matchId_submittedById: {
            matchId: sub.matchId,
            submittedById: targetId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        await tx.matchScoreSubmission.delete({ where: { id: sub.id } });
      } else {
        await tx.matchScoreSubmission.update({
          where: { id: sub.id },
          data: { submittedById: targetId },
        });
      }
    }
    await tx.matchScoreSubmission.updateMany({
      where: { forUserId: shellId },
      data: { forUserId: targetId },
    });
    await tx.applicationMessage.updateMany({
      where: { authorId: shellId },
      data: { authorId: targetId },
    });
    // Read cursors are @@unique([applicationId, userId]) and worthless to
    // carry over — the target has their own. Drop the shell's.
    await tx.applicationThreadRead.deleteMany({ where: { userId: shellId } });

    // ── Match audit columns ─────────────────────────────────────────────
    await tx.match.updateMany({
      where: { completedById: shellId },
      data: { completedById: targetId },
    });
    await tx.match.updateMany({
      where: { staffInputById: shellId },
      data: { staffInputById: targetId },
    });
    await tx.matchBlockLineup.updateMany({
      where: { submittedById: shellId },
      data: { submittedById: targetId },
    });

    // ── Finally drop the shell. Sessions, notifications, email tokens and
    // preferences all cascade from the User row; none of them are worth
    // carrying across (a shell has never signed in).
    await tx.emailToken.deleteMany({ where: { userId: shellId } });
    await tx.notification.deleteMany({ where: { userId: shellId } });
    await tx.user.delete({ where: { id: shellId } });

    return summary;
  });
}

/**
 * Round-88 — the guarded, side-effect-complete merge. Everything that takes a
 * shell over routes through here: the admin merge tool, the "I already have an
 * account" claim link, and an approved self-service claim request.
 *
 * On top of mergeShellIntoUser it:
 *   - refuses anything that isn't shell → real account,
 *   - rebuilds standings + MVP for every competition the shell played in
 *     (their rows now belong to a different id),
 *   - clears the placeholder flag on teams whose roster is now all real.
 */
export async function mergeShellIntoAccount(
  prisma: PrismaClient,
  shellId: string,
  targetId: string,
): Promise<MergeSummary> {
  if (shellId === targetId) {
    throw new GraphQLError("That's the same profile.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const [shell, target] = await Promise.all([
    prisma.user.findUnique({
      where: { id: shellId },
      select: { id: true, isShell: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, isShell: true, name: true },
    }),
  ]);
  if (!shell?.isShell) {
    throw new GraphQLError(
      "That profile isn't an unclaimed shell — there's nothing to merge.",
      { extensions: { code: "NOT_A_SHELL" } },
    );
  }
  if (!target) {
    throw new GraphQLError("Target player not found.", {
      extensions: { code: "NOT_FOUND" },
    });
  }
  if (target.isShell) {
    throw new GraphQLError(
      "You can only merge a shell into a real account, not into another shell.",
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }
  // Read the shell's competitions and teams BEFORE the merge — the rows that
  // identify them are exactly the ones about to change hands.
  const competitions = await competitionsForUser(prisma, shellId);
  const teamIds = await teamIdsForUser(prisma, shellId);

  const summary = await mergeShellIntoUser(prisma, shellId, targetId);

  for (const c of competitions) {
    await recomputeStandings(prisma as never, c.id);
    await recomputeMvp(prisma as never, c.id);
  }
  await refreshShellTeamFlags(prisma, teamIds);
  return summary;
}
