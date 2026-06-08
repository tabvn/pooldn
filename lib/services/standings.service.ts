import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Round-18 — MVP is the player with the highest frames-won percentage in
 * the competition (must have played at least one frame). Ties broken by
 * raw frames-won, then by lower frames-played (more efficient). Sets
 * `PlayerCompStat.isMvp` on the winning row, clears it on the rest.
 */
export async function recomputeMvp(
  prisma: PrismaClient,
  competitionId: string,
): Promise<void> {
  const stats = await prisma.playerCompStat.findMany({
    where: { competitionId },
    select: { id: true, framesWon: true, framesPlayed: true },
  });
  const eligible = stats.filter((s) => s.framesPlayed > 0);
  let mvpId: string | null = null;
  if (eligible.length > 0) {
    const sorted = [...eligible].sort((a, b) => {
      const winA = a.framesWon / a.framesPlayed;
      const winB = b.framesWon / b.framesPlayed;
      if (winB !== winA) return winB - winA;
      if (b.framesWon !== a.framesWon) return b.framesWon - a.framesWon;
      return a.framesPlayed - b.framesPlayed;
    });
    mvpId = sorted[0]!.id;
  }
  await prisma.playerCompStat.updateMany({
    where: { competitionId, NOT: { id: mvpId ?? "__none__" } },
    data: { isMvp: false },
  });
  if (mvpId) {
    await prisma.playerCompStat.update({
      where: { id: mvpId },
      data: { isMvp: true },
    });
  }
}

// Recompute Standing rows for a competition from its completed matches.
// Intended to run inside a transaction after a match is set to COMPLETED.
export async function recomputeStandings(
  prisma: PrismaClient,
  competitionId: string,
): Promise<void> {
  const competition = await prisma.competition.findUniqueOrThrow({
    where: { id: competitionId },
    select: { pointsWin: true, pointsDraw: true, pointsLoss: true },
  });

  // Standings only include teams whose application was APPROVED for this
  // competition. Rejected / cancelled / waitlisted / pending teams should
  // never appear in the table even if a match was recorded for them.
  const approvedApps = await prisma.competitionApplication.findMany({
    where: { competitionId, status: "APPROVED" },
    select: { teamId: true },
  });
  const approvedTeamIds = new Set(approvedApps.map((a) => a.teamId));

  // Drop any stale standings rows for non-approved teams.
  await prisma.standing.deleteMany({
    where: {
      competitionId,
      teamId: { notIn: Array.from(approvedTeamIds) },
    },
  });

  const matches = await prisma.match.findMany({
    where: {
      matchday: { competitionId },
      status: "COMPLETED",
      homeTeamId: { not: null },
      awayTeamId: { not: null },
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
    },
  });

  const stats = new Map<
    string,
    {
      played: number;
      won: number;
      drawn: number;
      lost: number;
      pointsFor: number;
      pointsAgainst: number;
      points: number;
    }
  >();

  // Seed every approved team with zero stats so they always appear in
  // the table (even if they haven't played yet).
  const touch = (teamId: string) => {
    let s = stats.get(teamId);
    if (!s) {
      s = {
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        points: 0,
      };
      stats.set(teamId, s);
    }
    return s;
  };
  for (const id of approvedTeamIds) touch(id);

  for (const m of matches) {
    if (!m.homeTeamId || !m.awayTeamId) continue;
    if (m.homeScore == null || m.awayScore == null) continue;
    if (
      !approvedTeamIds.has(m.homeTeamId) ||
      !approvedTeamIds.has(m.awayTeamId)
    ) {
      continue; // ignore matches involving non-approved teams
    }
    const home = touch(m.homeTeamId);
    const away = touch(m.awayTeamId);
    home.played += 1;
    away.played += 1;
    home.pointsFor += m.homeScore;
    home.pointsAgainst += m.awayScore;
    away.pointsFor += m.awayScore;
    away.pointsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      home.won += 1;
      away.lost += 1;
      home.points += competition.pointsWin;
      away.points += competition.pointsLoss;
    } else if (m.homeScore < m.awayScore) {
      away.won += 1;
      home.lost += 1;
      away.points += competition.pointsWin;
      home.points += competition.pointsLoss;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += competition.pointsDraw;
      away.points += competition.pointsDraw;
    }
  }

  // Sort & assign positions
  const ranked = [...stats.entries()].sort((a, b) => {
    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
    const pdA = a[1].pointsFor - a[1].pointsAgainst;
    const pdB = b[1].pointsFor - b[1].pointsAgainst;
    return pdB - pdA;
  });

  for (let i = 0; i < ranked.length; i++) {
    const [teamId, s] = ranked[i];
    const pointDiff = s.pointsFor - s.pointsAgainst;
    await prisma.standing.upsert({
      where: { competitionId_teamId: { competitionId, teamId } },
      update: {
        position: i + 1,
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        pointsFor: s.pointsFor,
        pointsAgainst: s.pointsAgainst,
        pointDiff,
        points: s.points,
      },
      create: {
        competitionId,
        teamId,
        position: i + 1,
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        pointsFor: s.pointsFor,
        pointsAgainst: s.pointsAgainst,
        pointDiff,
        points: s.points,
      },
    });
  }
}
