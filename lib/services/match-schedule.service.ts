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
  /** HH:mm — applied to every matchday so they don't all sit at midnight.
   *  Ignored when `weekdaySchedule` is provided (each slot has its own time). */
  matchdayStartTime?: string | null;
  /**
   * Round-48 (wizard) — the Figma "Scheduling Type → Weekly Rounds" builder.
   * When non-empty, matchdays land on the listed (weekday, time) slots in
   * order, cycling through the list. weekday = 0 (Sun)…6 (Sat), JS-style.
   *
   * Example:
   *   [{weekday: 2, time: "21:00"}, {weekday: 5, time: "21:00"}]
   * starting Mon Jun 8 → Tue Jun 9 21:00, Fri Jun 12 21:00, Tue Jun 16 21:00, …
   */
  weekdaySchedule?: Array<{ weekday: number; time: string }> | null;
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
 *   - `weekdaySchedule` non-empty → cycle through (weekday, time) slots and
 *     advance to the next future date for each slot.
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

  const slots = (input.weekdaySchedule ?? []).filter(
    (s) =>
      typeof s?.weekday === "number" &&
      s.weekday >= 0 &&
      s.weekday <= 6 &&
      typeof s?.time === "string",
  );

  if (slots.length > 0) {
    // Weekly-rounds mode — walk forward from `start`, fitting each matchday
    // to the next (weekday, time) slot in cycle. Each subsequent matchday
    // is guaranteed to land STRICTLY AFTER the previous one.
    const out: MatchdayPreview[] = [];
    let cursor = new Date(start.getTime());
    cursor.setHours(0, 0, 0, 0);
    for (let i = 0; i < count; i++) {
      const slot = slots[i % slots.length];
      const target = nextWeekdayAt(cursor, slot.weekday, slot.time);
      out.push({
        number: i + 1,
        label: `Matchday ${i + 1}`,
        scheduledDate: target.toISOString(),
      });
      // Move cursor 1ms after `target` so the next nextWeekdayAt() call
      // will move forward (and never re-pick the same day even when the
      // following slot is the same weekday).
      cursor = new Date(target.getTime() + 1);
    }
    return out;
  }

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

/**
 * Find the next occurrence of `weekday` at HH:mm on or after `from`. If
 * `from` is already that weekday at or before the target time, returns the
 * same day; otherwise advances 1–7 days.
 */
function nextWeekdayAt(from: Date, weekday: number, time: string): Date {
  let day = from.getDay();
  let delta = (weekday - day + 7) % 7;
  let candidate = new Date(from.getTime() + delta * DAY_MS);
  candidate = applyTime(candidate, time);
  if (candidate.getTime() <= from.getTime()) {
    candidate = new Date(candidate.getTime() + 7 * DAY_MS);
  }
  return candidate;
}
