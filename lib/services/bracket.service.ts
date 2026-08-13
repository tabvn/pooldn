/**
 * Round-67 — single-elimination bracket builder.
 *
 * Given the approved team ids, lay out a random-draw knockout bracket: pad the
 * field up to the next power of two, distribute byes one-per-pair among the top
 * of the draw, and pair the rest. Later rounds are laid out as empty (TBD)
 * matches that fill in as winners advance. Pure + deterministic given `rand`,
 * so it's easy to test; the resolver passes Math.random.
 */

export type BracketMatchPlan = {
  round: number; // 1 = first round … totalRounds = final
  position: number; // 0-based slot within the round
  home: string | null; // teamId, or null for a bye / not-yet-known slot
  away: string | null;
  isBye: boolean; // round-1 match with a single team → auto-advances
};

export type BracketPlan = {
  totalRounds: number;
  bracketSize: number;
  matches: BracketMatchPlan[];
};

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildBracket(
  teamIds: string[],
  rand: () => number = Math.random,
): BracketPlan {
  const n = teamIds.length;
  if (n < 2) {
    throw new Error("Need at least 2 teams for a bracket");
  }
  const bracketSize = 1 << Math.ceil(Math.log2(n));
  const totalRounds = Math.log2(bracketSize);
  const pairs = bracketSize / 2;
  const byes = bracketSize - n; // guaranteed < pairs (since n > bracketSize/2)

  const shuffled = shuffle(teamIds, rand);
  // Randomly pick which round-1 pairs receive a bye (at most one per pair).
  const byePairs = new Set(
    shuffle([...Array(pairs).keys()], rand).slice(0, byes),
  );

  const matches: BracketMatchPlan[] = [];
  let ti = 0;
  for (let p = 0; p < pairs; p++) {
    if (byePairs.has(p)) {
      matches.push({
        round: 1,
        position: p,
        home: shuffled[ti++]!,
        away: null,
        isBye: true,
      });
    } else {
      const home = shuffled[ti++]!;
      const away = shuffled[ti++]!;
      matches.push({ round: 1, position: p, home, away, isBye: false });
    }
  }
  // Rounds 2…final start empty (TBD).
  for (let r = 2; r <= totalRounds; r++) {
    const count = bracketSize / (1 << r);
    for (let p = 0; p < count; p++) {
      matches.push({ round: r, position: p, home: null, away: null, isBye: false });
    }
  }
  return { totalRounds, bracketSize, matches };
}

/** Where a match's winner advances: (round r, pos p) → (r+1, floor(p/2)). */
export function nextSlot(position: number): "HOME" | "AWAY" {
  return position % 2 === 0 ? "HOME" : "AWAY";
}

/** Human round label: Final / Semifinals / Quarterfinals / Round of N. */
export function roundName(round: number, totalRounds: number): string {
  const teamsInRound = 1 << (totalRounds - round + 1);
  if (teamsInRound === 2) return "Final";
  if (teamsInRound === 4) return "Semifinals";
  if (teamsInRound === 8) return "Quarterfinals";
  return `Round of ${teamsInRound}`;
}

type TxLike =
  | import("@/lib/generated/prisma/client").PrismaClient
  | Parameters<
      Parameters<
        import("@/lib/generated/prisma/client").PrismaClient["$transaction"]
      >[0]
    >[0];

/**
 * Round-67 — when a bracket match completes, push its winner into the next
 * round's slot. No-op for non-bracket matches (nextMatchId null → a final, or a
 * round-robin match). Idempotent: re-running just re-sets the same slot.
 */
export async function advanceBracketWinner(
  tx: TxLike,
  matchId: string,
): Promise<void> {
  const m = await tx.match.findUnique({
    where: { id: matchId },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homePlayerId: true,
      awayPlayerId: true,
      homeScore: true,
      awayScore: true,
      forfeitTeamId: true,
      winType: true,
      bracketRound: true,
      nextMatchId: true,
      nextMatchSlot: true,
      matchday: { select: { competitionId: true } },
    },
  });
  if (!m || m.bracketRound == null) return; // not a bracket match
  // A double no-show eliminates both sides — nobody advances.
  if (m.winType === "DOUBLE_FORFEIT") return;

  // Round-68 — brackets are team- OR player-based (singles). Resolve the two
  // participants generically so advancement works for both.
  const isPlayer = m.homePlayerId != null || m.awayPlayerId != null;
  const homeId = isPlayer ? m.homePlayerId : m.homeTeamId;
  const awayId = isPlayer ? m.awayPlayerId : m.awayTeamId;

  // Round-1 byes are resolved at generation (the lone side is advanced there),
  // so they never reach here. A match arriving with only one side set is a
  // not-yet-ready slot (opponent still TBD) that shouldn't advance — only a
  // forfeit or a real two-side score decides a winner.
  let winnerId: string | null = null;
  if (!isPlayer && m.forfeitTeamId) {
    // Loser forfeited → the other side advances (team forfeits only).
    winnerId =
      m.forfeitTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
  } else if (
    homeId != null &&
    awayId != null &&
    m.homeScore != null &&
    m.awayScore != null
  ) {
    if (m.homeScore > m.awayScore) winnerId = homeId;
    else if (m.awayScore > m.homeScore) winnerId = awayId;
  }
  if (!winnerId) return; // undecided (draw / not-ready) — nothing to advance

  // No next match → this is the final; the champion is decided but the
  // competition isn't finalised until the organizer publishes the winners
  // (Round-71). Round-robin has no advancement at all.
  if (m.nextMatchId) {
    const away = m.nextMatchSlot === "AWAY";
    await tx.match.update({
      where: { id: m.nextMatchId },
      data: isPlayer
        ? away
          ? { awayPlayerId: winnerId }
          : { homePlayerId: winnerId }
        : away
          ? { awayTeamId: winnerId }
          : { homeTeamId: winnerId },
    });
  }
}
