import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Round-47 — Figma MVP formula. For each player who appeared in any
 * MatchFrame of this competition we recompute:
 *
 *   appearances   = framesPlayed (every frame they were on either side)
 *   singlesWon    = frames they won where blockType=SINGLES
 *   doublesWon    = frames they won where blockType in (DOUBLES, SCOTCH_DOUBLES)
 *   brWon         = frames they won where breakAndRun=true
 *   mvpScore      = appearances + singlesWon*3 + doublesWon*2 + brWon*1
 *
 * The single MVP is the highest mvpScore. Ties broken by raw framesWon,
 * then by fewer framesPlayed (more efficient). PlayerCompStat rows for
 * players who haven't appeared remain at zero — they won't win MVP.
 */
export async function recomputeMvp(
  prisma: PrismaClient,
  competitionId: string,
): Promise<void> {
  // Pull every frame on a completed match in the competition. For each
  // frame we know homePlayerId / awayPlayerId (single-player blocks) and
  // the free-text duo labels (doubles). We attribute to the picked
  // player(s) on each side; rows without a userId reference can't move
  // PlayerCompStat — they only affect the team's frames-won count, not
  // the per-player MVP score.
  // Round-65 — the MVP formula is now organizer-configurable (the "calculator").
  const cfg = await prisma.competition.findUniqueOrThrow({
    where: { id: competitionId },
    select: {
      mvpPtAppearance: true,
      mvpPtSinglesWon: true,
      mvpPtDoublesWon: true,
      mvpPtBreakRun: true,
      mvpMinAppearancePct: true,
    },
  });

  // Round-65 — matchday-based appearance. teamMatchdays[team] = the distinct
  // matchdays the team actually played (completed matches); a player's
  // Appearance % is how many of THEIR team's matchdays they showed up for.
  const completedMatches = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      matchday: { competitionId },
    },
    select: { matchdayId: true, homeTeamId: true, awayTeamId: true },
  });
  const teamMatchdays = new Map<string, Set<string>>();
  const addTeamMd = (teamId: string | null, mdId: string) => {
    if (!teamId) return;
    let set = teamMatchdays.get(teamId);
    if (!set) teamMatchdays.set(teamId, (set = new Set()));
    set.add(mdId);
  };
  for (const m of completedMatches) {
    addTeamMd(m.homeTeamId, m.matchdayId);
    addTeamMd(m.awayTeamId, m.matchdayId);
  }

  // The player's team is their competition roster team — the authoritative
  // source. Appearance % is measured against THAT team's matchdays (not
  // whichever side a frame happened to list them on), so it can never exceed
  // 100% even if legacy data placed a player in another team's match.
  const rosterRows = await prisma.competitionRoster.findMany({
    where: { competitionId },
    select: { userId: true, teamId: true },
  });
  const rosterTeam = new Map(rosterRows.map((r) => [r.userId, r.teamId]));

  const frames = await prisma.matchFrame.findMany({
    where: {
      match: {
        status: "COMPLETED",
        matchday: { competitionId },
      },
      homeWon: { not: null },
    },
    select: {
      matchId: true,
      homeWon: true,
      blockType: true,
      breakAndRun: true,
      homePlayerId: true,
      awayPlayerId: true,
      match: {
        select: { matchdayId: true, homeTeamId: true, awayTeamId: true },
      },
    },
  });

  type Agg = {
    matches: Set<string>;
    matchdays: Set<string>;
    teamId: string | null;
    framesPlayed: number;
    framesWon: number;
    singlesPlayed: number;
    singlesWon: number;
    doublesPlayed: number;
    doublesWon: number;
    brWon: number;
  };
  const byUser = new Map<string, Agg>();
  const get = (id: string): Agg => {
    let a = byUser.get(id);
    if (!a) {
      a = {
        matches: new Set<string>(),
        matchdays: new Set<string>(),
        teamId: null,
        framesPlayed: 0,
        framesWon: 0,
        singlesPlayed: 0,
        singlesWon: 0,
        doublesPlayed: 0,
        doublesWon: 0,
        brWon: 0,
      };
      byUser.set(id, a);
    }
    return a;
  };
  for (const f of frames) {
    const isSingles = f.blockType === "SINGLES";
    const isDoubles =
      f.blockType === "DOUBLES" || f.blockType === "SCOTCH_DOUBLES";
    if (f.homePlayerId) {
      const a = get(f.homePlayerId);
      a.matches.add(f.matchId);
      a.matchdays.add(f.match.matchdayId);
      a.teamId = f.match.homeTeamId ?? a.teamId;
      a.framesPlayed += 1;
      if (isSingles) a.singlesPlayed += 1;
      if (isDoubles) a.doublesPlayed += 1;
      if (f.homeWon) {
        a.framesWon += 1;
        if (isSingles) a.singlesWon += 1;
        if (isDoubles) a.doublesWon += 1;
        if (f.breakAndRun) a.brWon += 1;
      }
    }
    if (f.awayPlayerId) {
      const a = get(f.awayPlayerId);
      a.matches.add(f.matchId);
      a.matchdays.add(f.match.matchdayId);
      a.teamId = f.match.awayTeamId ?? a.teamId;
      a.framesPlayed += 1;
      if (isSingles) a.singlesPlayed += 1;
      if (isDoubles) a.doublesPlayed += 1;
      if (f.homeWon === false) {
        a.framesWon += 1;
        if (isSingles) a.singlesWon += 1;
        if (isDoubles) a.doublesWon += 1;
        if (f.breakAndRun) a.brWon += 1;
      }
    }
  }

  // Write the breakdown back to PlayerCompStat. Use updateMany scoped to
  // the (competition, user) pair — the row may not exist yet for players
  // who just made their first appearance, so upsert.
  const writes: Promise<unknown>[] = [];
  for (const [userId, agg] of byUser) {
    const matchesPlayed = agg.matches.size;
    // Denominator = the player's roster team's played matchdays (fall back to
    // the team the frames listed them on if they aren't on a roster). The
    // numerator only counts matchdays that belong to that team's schedule, so
    // Appearance # ≤ team matchdays and Appearance % ≤ 100%.
    const teamId = rosterTeam.get(userId) ?? agg.teamId;
    const teamMds = teamId ? teamMatchdays.get(teamId) : undefined;
    const teamMd = teamMds?.size ?? agg.matchdays.size;
    const appearanceMatchdays = teamMds
      ? [...agg.matchdays].filter((md) => teamMds.has(md)).length
      : agg.matchdays.size;
    // Round-65 — configurable MVP formula. Appearances are matchday-based.
    const mvpScore =
      appearanceMatchdays * cfg.mvpPtAppearance +
      agg.singlesWon * cfg.mvpPtSinglesWon +
      agg.doublesWon * cfg.mvpPtDoublesWon +
      agg.brWon * cfg.mvpPtBreakRun;
    // framesWon counts every frame the player won, regardless of block type
    // (frames may carry no SINGLES/DOUBLES type, so deriving it from
    // singlesWon+doublesWon would undercount the Total column). framesPlayed
    // must be persisted too: the MVP eligibility filter below keys off the
    // stored framesPlayed column, so omitting it left every row at 0.
    const row = {
      matchesPlayed,
      appearanceMatchdays,
      teamMatchdays: teamMd,
      framesPlayed: agg.framesPlayed,
      framesWon: agg.framesWon,
      singlesPlayed: agg.singlesPlayed,
      singlesWon: agg.singlesWon,
      doublesPlayed: agg.doublesPlayed,
      doublesWon: agg.doublesWon,
      brWon: agg.brWon,
      mvpScore,
    };
    writes.push(
      prisma.playerCompStat.upsert({
        where: { competitionId_userId: { competitionId, userId } },
        update: row,
        create: { competitionId, userId, ...row },
      }),
    );
  }
  await Promise.all(writes);

  // Pick MVP: highest mvpScore, tiebreak by framesWon then fewer framesPlayed.
  // Round-65 — a player must clear the appearance-% threshold to be eligible.
  const stats = await prisma.playerCompStat.findMany({
    where: { competitionId },
    select: {
      id: true,
      framesWon: true,
      framesPlayed: true,
      mvpScore: true,
      appearanceMatchdays: true,
      teamMatchdays: true,
    },
  });
  const eligible = stats.filter((s) => {
    if (s.framesPlayed <= 0) return false;
    const pct =
      s.teamMatchdays > 0
        ? (s.appearanceMatchdays / s.teamMatchdays) * 100
        : 0;
    return pct >= cfg.mvpMinAppearancePct;
  });
  let mvpId: string | null = null;
  if (eligible.length > 0) {
    const sorted = [...eligible].sort((a, b) => {
      if (b.mvpScore !== a.mvpScore) return b.mvpScore - a.mvpScore;
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
    // Round-53 — standings are team-only; solo INDIVIDUAL apps don't
    // populate this table at all.
    where: { competitionId, status: "APPROVED", teamId: { not: null } },
    select: { teamId: true },
  });
  const approvedTeamIds = new Set(
    approvedApps.map((a) => a.teamId).filter((id): id is string => Boolean(id)),
  );

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

  // Round-30 — tie-breakers, in order: points → head-to-head (sum of points
  // earned in matches between the two teams) → point difference → points-for
  // → team name (stable). H2H is only meaningful when sorting *pairs*, so we
  // first sort by all non-H2H keys and then apply a stable bubble swap that
  // promotes a tied team that beats its sibling head-to-head.
  function h2hPoints(a: string, b: string) {
    let pa = 0;
    let pb = 0;
    for (const m of matches) {
      const isAB =
        (m.homeTeamId === a && m.awayTeamId === b) ||
        (m.homeTeamId === b && m.awayTeamId === a);
      if (!isAB) continue;
      if (m.homeScore == null || m.awayScore == null) continue;
      const aIsHome = m.homeTeamId === a;
      const aScore = aIsHome ? m.homeScore : m.awayScore;
      const bScore = aIsHome ? m.awayScore : m.homeScore;
      if (aScore > bScore) {
        pa += competition.pointsWin;
        pb += competition.pointsLoss;
      } else if (aScore < bScore) {
        pb += competition.pointsWin;
        pa += competition.pointsLoss;
      } else {
        pa += competition.pointsDraw;
        pb += competition.pointsDraw;
      }
    }
    return [pa, pb] as const;
  }

  const teamName = await prisma.team.findMany({
    where: { id: { in: Array.from(approvedTeamIds) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(teamName.map((t) => [t.id, t.name]));

  const ranked = [...stats.entries()].sort((a, b) => {
    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
    const pdA = a[1].pointsFor - a[1].pointsAgainst;
    const pdB = b[1].pointsFor - b[1].pointsAgainst;
    if (pdB !== pdA) return pdB - pdA;
    if (b[1].pointsFor !== a[1].pointsFor)
      return b[1].pointsFor - a[1].pointsFor;
    const nA = nameById.get(a[0]) ?? "";
    const nB = nameById.get(b[0]) ?? "";
    return nA.localeCompare(nB);
  });

  // Promote head-to-head winners within tied groups. A pass of adjacent
  // swaps is enough because the base sort already grouped ties together.
  for (let i = 0; i < ranked.length - 1; i++) {
    const [aId, aS] = ranked[i];
    const [bId, bS] = ranked[i + 1];
    if (aS.points !== bS.points) continue;
    const aPd = aS.pointsFor - aS.pointsAgainst;
    const bPd = bS.pointsFor - bS.pointsAgainst;
    if (aPd !== bPd) continue;
    const [aH2H, bH2H] = h2hPoints(aId, bId);
    if (bH2H > aH2H) {
      ranked[i] = [bId, bS];
      ranked[i + 1] = [aId, aS];
    }
  }

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
