import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const PRIZE_NUM = new Intl.NumberFormat("en-US")

/**
 * Round-76 — `Competition.prizePool` is free text, so an organizer can write
 * "10,000,000", "5M + trophy" or "Cash + table time" without the field
 * rejecting it.
 *
 * Round-83 — there is no separate currency any more: whatever unit the prize
 * is in, the organizer types it. A value that reads as a bare amount still
 * gets thousands separators so "5000000" renders as "5,000,000"; anything
 * else is shown exactly as written.
 *
 * Returns null when there's no prize, so callers can keep using a truthiness
 * check to decide whether to render the row/chip at all.
 */
export function formatPrize(
  prizePool: string | null | undefined,
): string | null {
  const raw = prizePool?.trim()
  if (!raw) return null
  // Bare amount: digits, optional , or space grouping, optional decimal tail.
  if (/^\d[\d,\s]*(\.\d+)?$/.test(raw)) {
    const n = Number(raw.replace(/[,\s]/g, ""))
    if (Number.isFinite(n)) return PRIZE_NUM.format(n)
  }
  return raw
}
