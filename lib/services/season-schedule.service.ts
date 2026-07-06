import { assignVenuesWithCap, bergerPairings } from "./scheduling.service";
import { planMatchdays } from "./match-schedule.service";

/**
 * Round-63 — single source of truth for the round-robin season schedule.
 *
 * Both the dry-run preview (previewMatchdays) and the real generation
 * (generateMatchdays) call this so the schedule the organizer previews is
 * byte-for-byte what gets persisted on Confirm. Pure/deterministic: no DB
 * access, no persistence — hand it the teams + config and it returns the
 * planned matchdays (with venue assignment applied).
 */

export type SeasonScheduleInput = {
  teamIds: string[];
  gamesPerOpponent: number;
  startDate: string | Date | null | undefined;
  endDate: string | Date | null | undefined;
  weekdaySchedule?: Array<{ weekday: number; time: string }> | null;
  matchVenueMode: string | null;
  centralVenueId: string | null;
  /** teamId → its resolved home venue id (or the central venue for all). */
  homeVenueByTeam: Map<string, string | null>;
  /** Max games one venue may host per matchday. null = unlimited. */
  cap: number | null;
};

export type PlannedMatch = {
  home: string;
  away: string;
  venueId: string | null;
  /** Home/away was flipped from the Berger draw to satisfy the venue cap. */
  swapped: boolean;
};

export type PlannedMatchday = {
  number: number;
  label: string;
  /** ISO string. */
  scheduledDate: string;
  matches: PlannedMatch[];
  /** Teams sitting out this matchday (odd team count → one bye per round). */
  byeTeamIds: string[];
};

/** Narrow the competition's JSON weekdaySchedule to typed {weekday,time} slots. */
export function parseWeekdaySchedule(
  raw: unknown,
): Array<{ weekday: number; time: string }> {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter(
      (s): s is { weekday: number; time: string } =>
        typeof s === "object" &&
        s !== null &&
        "weekday" in s &&
        "time" in s &&
        typeof (s as { weekday: unknown }).weekday === "number" &&
        typeof (s as { time: unknown }).time === "string",
    )
    .map((s) => ({ weekday: s.weekday, time: s.time }));
}

export function computeSeasonSchedule(
  input: SeasonScheduleInput,
): PlannedMatchday[] {
  const baseRounds = bergerPairings(input.teamIds);
  // Games per opponent: 1 = single round robin; 2 = home & away. Tile the
  // Berger pairings N times and FLIP home/away on alternate cycles.
  const cycles = Math.max(1, Math.min(4, Number(input.gamesPerOpponent ?? 1)));
  const rounds: Array<Array<[string, string]>> = [];
  for (let c = 0; c < cycles; c++) {
    for (const round of baseRounds) {
      rounds.push(
        c % 2 === 0
          ? round.map((m) => [m[0], m[1]] as [string, string])
          : round.map((m) => [m[1], m[0]] as [string, string]),
      );
    }
  }

  const planned = planMatchdays({
    startDate: input.startDate,
    endDate: input.endDate,
    matchdayCount: rounds.length,
    weekdaySchedule: input.weekdaySchedule ?? [],
  });

  const useCentral = input.matchVenueMode === "CENTRAL_VENUE";
  const scheduled = useCentral
    ? rounds.map((round) =>
        round.map((m) => ({
          home: m[0],
          away: m[1],
          venueId: input.centralVenueId ?? null,
          swapped: false,
        })),
      )
    : assignVenuesWithCap(rounds, input.homeVenueByTeam, input.cap);

  return rounds.map((_, i) => {
    const matches = scheduled[i]!;
    const playing = new Set(matches.flatMap((m) => [m.home, m.away]));
    return {
      number: i + 1,
      label: `Matchday ${i + 1}`,
      scheduledDate: planned[i]!.scheduledDate,
      matches,
      byeTeamIds: input.teamIds.filter((id) => !playing.has(id)),
    };
  });
}
