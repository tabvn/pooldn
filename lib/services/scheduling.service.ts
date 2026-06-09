/**
 * Berger round-robin pairing — given N teams, returns N-1 rounds (when N is
 * even) or N rounds (when N is odd — a "BYE" slot rotates). Each round is a
 * list of [homeId, awayId] tuples; "BYE" indicates a team rests that round.
 *
 * Implementation: classic circle method. Fix team[0]; rotate the rest
 * clockwise. Round k pairs index 0 with last, 1 with second-to-last, etc.
 */
export function bergerPairings(
  teamIds: string[],
): Array<Array<[string, string]>> {
  if (teamIds.length < 2) return [];
  const ids = [...teamIds];
  const odd = ids.length % 2 === 1;
  if (odd) ids.push("BYE");

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;

  const arr = ids.slice();
  const result: Array<Array<[string, string]>> = [];
  for (let r = 0; r < rounds; r++) {
    const round: Array<[string, string]> = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === "BYE" || b === "BYE") continue;
      // Alternate home/away for fairness.
      if (r % 2 === 0) round.push([a, b]);
      else round.push([b, a]);
    }
    result.push(round);
    // Rotate everyone except the first.
    const last = arr.pop()!;
    arr.splice(1, 0, last);
  }
  return result;
}

export type ScheduledMatch = {
  home: string;
  away: string;
  /** Resolved venue. Null when no homeVenue is known on either team OR
   *  the cap blocked every candidate. */
  venueId: string | null;
  /** True when home/away was flipped from the input to fit the cap.
   *  Lets the caller record this for observability if useful. */
  swapped: boolean;
};

/**
 * Round-47 — venue assignment + max-games-per-venue-per-matchday cap.
 *
 * For each round of pairings, assign a venue to every match. Default: the
 * home team's homeVenue. When a competition specifies
 * `maxGamesPerVenuePerMatchday`, the assigner can FLIP home/away on a
 * match so it plays at the away team's venue instead — preserves the cap
 * without dropping matches. If both teams' venues are saturated, we leave
 * `venueId: null` and let the organizer pick later.
 *
 * Tradeoff: a cap-driven swap sacrifices the Berger home/away alternation
 * for that single match. That's better than refusing to schedule it.
 */
export function assignVenuesWithCap(
  rounds: ReadonlyArray<ReadonlyArray<readonly [string, string]>>,
  homeVenueByTeam: Map<string, string | null>,
  cap: number | null,
): ScheduledMatch[][] {
  return rounds.map((round) => {
    // Per-round venue counter — capped state is local to the matchday.
    const venueCount = new Map<string, number>();
    const inc = (v: string) => venueCount.set(v, (venueCount.get(v) ?? 0) + 1);
    const at = (v: string | null) => (v ? (venueCount.get(v) ?? 0) : Infinity);
    const overCap = (v: string | null) =>
      cap !== null && v !== null && at(v) >= cap;

    const out: ScheduledMatch[] = [];
    for (const [home, away] of round) {
      const homeVenue = homeVenueByTeam.get(home) ?? null;
      const awayVenue = homeVenueByTeam.get(away) ?? null;

      // Default: home team's homeVenue if it has capacity.
      if (homeVenue && !overCap(homeVenue)) {
        inc(homeVenue);
        out.push({ home, away, venueId: homeVenue, swapped: false });
        continue;
      }
      // Home venue is at/over cap → try flipping so away team hosts.
      if (awayVenue && !overCap(awayVenue)) {
        inc(awayVenue);
        out.push({
          home: away,
          away: home,
          venueId: awayVenue,
          swapped: true,
        });
        continue;
      }
      // We get here because both candidate venues failed the cap check
      // (or both are null). If a cap is set, RESPECT it strictly — leave
      // venueId null and let the organizer place this match by hand.
      // Allocating anyway would silently exceed the cap they asked for.
      // No cap + both venues null → also null (nothing to assign).
      out.push({ home, away, venueId: null, swapped: false });
    }
    return out;
  });
}
