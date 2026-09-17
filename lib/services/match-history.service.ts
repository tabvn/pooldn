/**
 * Round-90 — a player's match history, for their profile.
 *
 * "Which matches are mine?" has four answers in this app, and a profile that
 * only knew one of them would look broken:
 *
 *   1. Singles (INDIVIDUAL) — the match itself names the two players.
 *   2. Team formats, played — the player appears in a MatchFrame, or carries a
 *      MatchParticipant row for the match.
 *   3. Team formats, SCHEDULED — nobody is in a lineup yet, so neither of the
 *      above exists. The match is still theirs: their team is playing it and
 *      they're on that competition's roster. This is the half people actually
 *      want on a profile ("who do I play next?").
 *   4. Placeholders — identical to the above. A shell is rostered and appears
 *      in frames like anyone else, so it needs no special case, and the rows
 *      follow the profile when the placeholder is merged into a real account
 *      (the merge moves rosters, frames, participants and singles matches).
 */
import type { PrismaClient } from "@/lib/generated/prisma/client";

export type MatchSide = "HOME" | "AWAY";

export type PlayerMatchRow = {
  matchId: string;
  /** Which side the player was on, when we can tell. */
  side: MatchSide | null;
  /** They actually appeared — a frame or a participant row, not just rostered. */
  played: boolean;
  framesPlayed: number;
  framesWon: number;
  /** Sort key: scheduled time, falling back to creation order. */
  scheduledAt: Date | null;
  status: string;
};

type Acc = Map<string, PlayerMatchRow>;

function upsert(acc: Acc, matchId: string): PlayerMatchRow {
  let row = acc.get(matchId);
  if (!row) {
    row = {
      matchId,
      side: null,
      played: false,
      framesPlayed: 0,
      framesWon: 0,
      scheduledAt: null,
      status: "SCHEDULED",
    };
    acc.set(matchId, row);
  }
  return row;
}

/**
 * Every match this user belongs to, with the side they played and their own
 * frame tally where one exists. Capped generously — a profile renders a slice.
 */
export async function playerMatches(
  prisma: PrismaClient,
  userId: string,
  opts: { take?: number } = {},
): Promise<PlayerMatchRow[]> {
  const acc: Acc = new Map();

  // 1 + 3 — singles matches, and every match belonging to a team this user is
  // rostered on. One query each; the roster case is what surfaces fixtures
  // that haven't been lined up yet.
  const rosters = await prisma.competitionRoster.findMany({
    where: { userId },
    select: { competitionId: true, teamId: true },
  });
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { homePlayerId: userId },
        { awayPlayerId: userId },
        ...rosters.map((r) => ({
          matchday: { competitionId: r.competitionId },
          OR: [{ homeTeamId: r.teamId }, { awayTeamId: r.teamId }],
        })),
      ],
    },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      homeTeamId: true,
      awayTeamId: true,
      homePlayerId: true,
      awayPlayerId: true,
    },
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    // A full league season is hundreds of fixtures per competition and a player
    // can be in several. This cap drops the OLDEST rows, so set it high enough
    // that a real career doesn't lose its early history.
    take: opts.take ?? 1000,
  });
  const rosterTeamIds = new Set(rosters.map((r) => r.teamId));
  for (const m of matches) {
    const row = upsert(acc, m.id);
    row.scheduledAt = m.scheduledAt;
    row.status = m.status;
    if (m.homePlayerId === userId) row.side = "HOME";
    else if (m.awayPlayerId === userId) row.side = "AWAY";
    else if (m.homeTeamId && rosterTeamIds.has(m.homeTeamId)) row.side = "HOME";
    else if (m.awayTeamId && rosterTeamIds.has(m.awayTeamId)) row.side = "AWAY";
    // A singles match names its players, so being on it IS playing it.
    if (m.homePlayerId === userId || m.awayPlayerId === userId) {
      row.played = true;
    }
  }

  // 2 — frames they were named in. Catches team matches for a player who is no
  // longer on the roster (left the team mid-season) as well as their tally.
  const frames = await prisma.matchFrame.findMany({
    where: { OR: [{ homePlayerId: userId }, { awayPlayerId: userId }] },
    select: {
      matchId: true,
      homeWon: true,
      homePlayerId: true,
      match: {
        select: { status: true, scheduledAt: true },
      },
    },
  });
  for (const f of frames) {
    const row = upsert(acc, f.matchId);
    row.played = true;
    row.scheduledAt = row.scheduledAt ?? f.match.scheduledAt;
    row.status = f.match.status;
    const onHome = f.homePlayerId === userId;
    row.side = row.side ?? (onHome ? "HOME" : "AWAY");
    if (f.homeWon !== null) {
      row.framesPlayed += 1;
      if (f.homeWon === onHome) row.framesWon += 1;
    }
  }

  // MatchParticipant is the authoritative per-match tally once a match is
  // complete; prefer it over the frame count derived above.
  const participants = await prisma.matchParticipant.findMany({
    where: { userId },
    select: {
      matchId: true,
      framesWon: true,
      framesPlayed: true,
      teamId: true,
      match: { select: { status: true, scheduledAt: true, homeTeamId: true } },
    },
  });
  for (const p of participants) {
    const row = upsert(acc, p.matchId);
    row.played = true;
    row.scheduledAt = row.scheduledAt ?? p.match.scheduledAt;
    row.status = p.match.status;
    if (p.framesPlayed > 0) {
      row.framesPlayed = p.framesPlayed;
      row.framesWon = p.framesWon;
    }
    if (!row.side && p.teamId) {
      row.side = p.match.homeTeamId === p.teamId ? "HOME" : "AWAY";
    }
  }

  return [...acc.values()].sort((a, b) => {
    const av = a.scheduledAt?.getTime() ?? 0;
    const bv = b.scheduledAt?.getTime() ?? 0;
    return bv - av;
  });
}

/** Has this match already happened (or is happening)? */
export function isPast(row: PlayerMatchRow): boolean {
  if (row.status === "COMPLETED" || row.status === "CANCELLED") return true;
  if (row.status === "IN_PROGRESS") return false;
  return row.scheduledAt ? row.scheduledAt.getTime() < Date.now() : false;
}
