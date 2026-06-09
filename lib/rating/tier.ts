/**
 * Round-47 — player rating tiers.
 *
 * Maps an ELO rating to a named tier with colors + threshold metadata.
 * Default rating is 1000 (see rating.service.ts) so the entry tier
 * "Amateur" is centered there; players cross into "Sharp" once they net
 * out a couple solid wins. Top tier is "Grandmaster" at 1850+.
 *
 * Thresholds are inclusive on the lower bound. `next` is null on the top
 * tier; otherwise it's the rating needed to advance, useful for "X pts to
 * Diamond" copy on the profile.
 */
export type RatingTierKey =
  | "ROOKIE"
  | "AMATEUR"
  | "SHARP"
  | "PRO"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER";

/** Lucide icon name — resolved in the badge component to keep this file
 *  framework-free (importable from anywhere, including tests). */
export type RatingTierIcon =
  | "shield"
  | "circle"
  | "target"
  | "star"
  | "gem"
  | "trophy"
  | "crown";

export type RatingTier = {
  key: RatingTierKey;
  /** Display name. */
  name: string;
  /** 1-based tier ordinal — used for the star-strip indicator. */
  ordinal: number;
  /** Lower bound, inclusive. */
  min: number;
  /** Upper bound, exclusive — null on the top tier. */
  next: number | null;
  /** Lucide icon name for the badge. */
  icon: RatingTierIcon;
  /** Solid base color. */
  color: string;
  /** Lighter accent for the bevel + glow. */
  accent: string;
  /** Linear-gradient definition for hero treatments. */
  gradient: string;
  /** Short flavor used on the profile hero tier card. */
  blurb: string;
};

export const RATING_TIERS: readonly RatingTier[] = [
  {
    key: "ROOKIE",
    name: "Rookie",
    ordinal: 1,
    min: 0,
    next: 950,
    icon: "shield",
    color: "#64748b",
    accent: "#cbd5e1",
    gradient: "linear-gradient(135deg, #94a3b8 0%, #475569 70%, #1e293b 100%)",
    blurb: "Getting reps in. Every frame counts.",
  },
  {
    key: "AMATEUR",
    name: "Amateur",
    ordinal: 2,
    min: 950,
    next: 1100,
    icon: "circle",
    color: "#15803d",
    accent: "#86efac",
    gradient: "linear-gradient(135deg, #4ade80 0%, #15803d 70%, #052e16 100%)",
    blurb: "Reliable in the pocket — climbing fast.",
  },
  {
    key: "SHARP",
    name: "Sharp",
    ordinal: 3,
    min: 1100,
    next: 1250,
    icon: "target",
    color: "#0369a1",
    accent: "#7dd3fc",
    gradient: "linear-gradient(135deg, #38bdf8 0%, #0369a1 70%, #082f49 100%)",
    blurb: "Reads the table. Knows the angles.",
  },
  {
    key: "PRO",
    name: "Pro",
    ordinal: 4,
    min: 1250,
    next: 1450,
    icon: "star",
    color: "#7e22ce",
    accent: "#d8b4fe",
    gradient: "linear-gradient(135deg, #c084fc 0%, #7e22ce 70%, #2e1065 100%)",
    blurb: "Plays at a tournament level.",
  },
  {
    key: "DIAMOND",
    name: "Diamond",
    ordinal: 5,
    min: 1450,
    next: 1650,
    icon: "gem",
    color: "#0e7490",
    accent: "#67e8f9",
    gradient: "linear-gradient(135deg, #67e8f9 0%, #0891b2 60%, #083344 100%)",
    blurb: "Sharp, consistent, and dangerous.",
  },
  {
    key: "MASTER",
    name: "Master",
    ordinal: 6,
    min: 1650,
    next: 1850,
    icon: "trophy",
    color: "#b45309",
    accent: "#fcd34d",
    gradient: "linear-gradient(135deg, #fbbf24 0%, #b45309 60%, #451a03 100%)",
    blurb: "Top of the regional ladder.",
  },
  {
    key: "GRANDMASTER",
    name: "Grandmaster",
    ordinal: 7,
    min: 1850,
    next: null,
    icon: "crown",
    color: "#b91c1c",
    accent: "#fca5a5",
    gradient:
      "linear-gradient(135deg, #fbbf24 0%, #f87171 35%, #b91c1c 75%, #450a0a 100%)",
    blurb: "Elite. Plays for the trophy.",
  },
] as const;

export function tierFromRating(rating: number): RatingTier {
  let current: RatingTier = RATING_TIERS[0]!;
  for (const t of RATING_TIERS) {
    if (rating >= t.min) current = t;
    else break;
  }
  return current;
}

/**
 * How many rating points the player needs to reach the next tier — null when
 * they're already at Grandmaster.
 */
export function pointsToNextTier(rating: number): number | null {
  const t = tierFromRating(rating);
  if (t.next === null) return null;
  return Math.max(0, t.next - rating);
}
