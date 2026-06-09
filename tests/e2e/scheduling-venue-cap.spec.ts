import { expect, test } from "@playwright/test";
import {
  assignVenuesWithCap,
  bergerPairings,
} from "../../lib/services/scheduling.service";

/**
 * Round-47 — covers the max-games-per-venue cap behavior. Pure compute,
 * no server. Lives under tests/e2e so we don't bring in another runner.
 */
test.describe("assignVenuesWithCap", () => {
  test("no cap → every match plays at the home team's home venue", () => {
    const rounds = bergerPairings(["A", "B", "C", "D"]);
    const venueByTeam = new Map([
      ["A", "v1"],
      ["B", "v1"],
      ["C", "v2"],
      ["D", "v2"],
    ]);
    const out = assignVenuesWithCap(rounds, venueByTeam, null);
    for (const round of out) {
      for (const m of round) {
        expect(m.swapped).toBe(false);
        expect(m.venueId).toBe(venueByTeam.get(m.home));
      }
    }
  });

  test("cap=1 with two home teams sharing v1 → second match swaps to away venue", () => {
    // Round 0: A vs D, B vs C. Both A and B host at v1 → cap=1 forces
    // one of them to swap. D and C host at v2/v3 (different venues).
    const venueByTeam = new Map([
      ["A", "v1"],
      ["B", "v1"],
      ["C", "v3"],
      ["D", "v2"],
    ]);
    const round0: ReadonlyArray<readonly [string, string]> = [
      ["A", "D"],
      ["B", "C"],
    ];
    const [out] = assignVenuesWithCap([round0], venueByTeam, 1);
    expect(out).toHaveLength(2);
    // First match keeps home venue v1 (count 0 → 1, under cap).
    expect(out[0]!.venueId).toBe("v1");
    expect(out[0]!.swapped).toBe(false);
    // Second match's home venue is also v1 — already at cap → flip so it
    // plays at C's venue v3.
    expect(out[1]!.venueId).toBe("v3");
    expect(out[1]!.swapped).toBe(true);
    expect(out[1]!.home).toBe("C");
    expect(out[1]!.away).toBe("B");
  });

  test("cap=1 with both teams' venues saturated → venueId null, no swap", () => {
    // Engineered: 3 matches, only one venue exists, cap=1.
    const venueByTeam = new Map([
      ["A", "v1"],
      ["B", "v1"],
      ["C", "v1"],
      ["D", "v1"],
      ["E", "v1"],
      ["F", "v1"],
    ]);
    const round0: ReadonlyArray<readonly [string, string]> = [
      ["A", "B"],
      ["C", "D"],
      ["E", "F"],
    ];
    const [out] = assignVenuesWithCap([round0], venueByTeam, 1);
    expect(out[0]!.venueId).toBe("v1");
    // The remaining two can't fit — both teams have v1, both at cap.
    expect(out[1]!.venueId).toBe(null);
    expect(out[2]!.venueId).toBe(null);
  });

  test("teams with no homeVenue → venueId null even without a cap", () => {
    const venueByTeam = new Map<string, string | null>([
      ["A", null],
      ["B", null],
    ]);
    const [out] = assignVenuesWithCap([[["A", "B"]]], venueByTeam, null);
    expect(out[0]!.venueId).toBe(null);
  });

  test("each round resets the venue counter", () => {
    // cap=1, venueA used in round 0, but round 1 must start fresh.
    const venueByTeam = new Map([
      ["A", "v1"],
      ["B", "v2"],
    ]);
    const rounds: ReadonlyArray<ReadonlyArray<readonly [string, string]>> = [
      [["A", "B"]],
      [["A", "B"]],
    ];
    const out = assignVenuesWithCap(rounds, venueByTeam, 1);
    expect(out[0]![0]!.venueId).toBe("v1");
    expect(out[1]![0]!.venueId).toBe("v1");
  });
});
