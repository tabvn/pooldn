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
