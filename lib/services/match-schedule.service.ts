/**
 * Round-47 — pure-compute date distribution used by:
 *   - the create-competition wizard's "Season Preview" step (client-side
 *     so the organizer can review dates before publish),
 *   - the post-publish `generateMatchdays` mutation (same dates, same
 *     spacing, so what the organizer previewed matches what gets
 *     created).
 *
 * Inputs are flat scalars so this can be called from anywhere (server
 * resolver, client form, tests) without dragging Prisma into the
 * caller's module graph.
 */

export type MatchdayPreview = {
  number: number;
  label: string;
  /** ISO string so the consumer doesn't have to worry about Date/SSR. */
  scheduledDate: string;
};

export type ScheduleInput = {
  /** YYYY-MM-DD or full ISO. Falls back to today when missing. */
  startDate: string | Date | null | undefined;
  /** Optional cap — if both startDate + endDate are set we use endDate as
   *  the LAST matchday and distribute evenly. Otherwise weekly spacing. */
  endDate: string | Date | null | undefined;
  /** How many matchdays to lay out. Clamped to [1, 52]. */
  matchdayCount: number;
  /** HH:mm — applied to every matchday so they don't all sit at midnight. */
  matchdayStartTime?: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(v: string | Date | null | undefined): Date {
  if (!v) return new Date();
  if (v instanceof Date) return new Date(v.getTime());
  return new Date(v);
}

function applyTime(d: Date, hhmm: string | null | undefined): Date {
  if (!hhmm) return d;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return d;
  const hours = Math.min(23, Math.max(0, Number(m[1])));
  const minutes = Math.min(59, Math.max(0, Number(m[2])));
  const out = new Date(d.getTime());
  out.setHours(hours, minutes, 0, 0);
  return out;
}

/**
 * Lay out N matchdays starting at `startDate`. Spacing rules:
 *   - both start + end given → evenly distribute across the window so the
 *     last matchday lands on (or just before) endDate.
 *   - start only → weekly cadence (7 days between matchdays).
 *
 * Always returns exactly `matchdayCount` rows numbered 1..N.
 */
export function planMatchdays(input: ScheduleInput): MatchdayPreview[] {
  const count = Math.min(52, Math.max(1, input.matchdayCount));
  const start = toDate(input.startDate);
  const end = input.endDate ? toDate(input.endDate) : null;

  let stepMs = 7 * DAY_MS;
  if (end && count > 1) {
    const spanMs = end.getTime() - start.getTime();
    if (spanMs > 0) {
      stepMs = Math.max(DAY_MS, Math.floor(spanMs / (count - 1)));
    }
  }

  const out: MatchdayPreview[] = [];
  for (let i = 0; i < count; i++) {
    const d = applyTime(
      new Date(start.getTime() + i * stepMs),
      input.matchdayStartTime,
    );
    out.push({
      number: i + 1,
      label: `Matchday ${i + 1}`,
      scheduledDate: d.toISOString(),
    });
  }
  return out;
}
