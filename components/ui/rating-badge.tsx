import {
  Circle,
  Crown,
  Gem,
  Shield,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  tierFromRating,
  type RatingTier,
  type RatingTierIcon,
} from "@/lib/rating/tier";

type Size = "sm" | "md" | "lg";

const ICONS: Record<RatingTierIcon, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  circle: Circle,
  target: Target,
  star: Star,
  gem: Gem,
  trophy: Trophy,
  crown: Crown,
};

/**
 * Round-47 — Player rating tier badge (professional treatment).
 *
 * Pill style: Lucide icon in a tinted circle, tier name, optional rating
 * pill. Hero variant: large icon medallion with bevel + glow, tier name,
 * star-strip showing tier ordinal (1–7), ELO score.
 */
export function RatingBadge({
  rating,
  size = "md",
  showRating = false,
  variant = "pill",
  className,
}: {
  rating: number;
  size?: Size;
  showRating?: boolean;
  variant?: "pill" | "hero";
  className?: string;
}) {
  const tier = tierFromRating(rating);
  if (variant === "hero") return <HeroBadge tier={tier} rating={rating} />;
  const Icon = ICONS[tier.icon];
  return (
    <span
      data-testid={`rating-badge-${tier.key.toLowerCase()}`}
      title={`${tier.name} · ${rating} ELO`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap shadow-sm",
        size === "sm" && "h-6 pl-1 pr-2 text-[11px]",
        size === "md" && "h-7 pl-1 pr-2.5 text-xs",
        size === "lg" && "h-8 pl-1.5 pr-3 text-sm",
        className,
      )}
      style={{
        borderColor: tier.color,
        background: `linear-gradient(180deg, ${withAlpha(tier.accent, 0.18)} 0%, ${withAlpha(tier.color, 0.12)} 100%)`,
        color: tier.accent,
      }}
    >
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center rounded-full"
        style={{
          background: tier.gradient,
          width: size === "sm" ? 18 : size === "md" ? 20 : 24,
          height: size === "sm" ? 18 : size === "md" ? 20 : 24,
          boxShadow: `0 0 0 1px ${tier.color}`,
        }}
      >
        <Icon
          className={cn(
            "text-white drop-shadow",
            size === "sm" ? "size-2.5" : size === "md" ? "size-3" : "size-3.5",
          )}
        />
      </span>
      <span className="uppercase tracking-wider" style={{ color: tier.accent }}>
        {tier.name}
      </span>
      {showRating ? (
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
          style={{ background: withAlpha("#000000", 0.4), color: "#fff" }}
        >
          {rating}
        </span>
      ) : null}
    </span>
  );
}

function HeroBadge({ tier, rating }: { tier: RatingTier; rating: number }) {
  const Icon = ICONS[tier.icon];
  return (
    <div
      data-testid={`rating-hero-${tier.key.toLowerCase()}`}
      className="relative overflow-hidden rounded-2xl border border-white/10 px-4 py-4 shadow-lg"
      style={{ background: tier.gradient }}
    >
      {/* Decorative ring + glow behind the medallion */}
      <span
        aria-hidden
        className="absolute -right-10 -top-10 size-44 rounded-full blur-3xl pointer-events-none"
        style={{ background: withAlpha(tier.accent, 0.35) }}
      />
      <div className="relative flex items-center gap-4 text-white">
        <span
          className="inline-flex size-14 shrink-0 items-center justify-center rounded-full border-2"
          style={{
            background: "rgba(0,0,0,0.35)",
            borderColor: tier.accent,
            boxShadow: `0 0 0 4px ${withAlpha(tier.accent, 0.18)}`,
          }}
          aria-hidden
        >
          <Icon className="size-7 text-white drop-shadow" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">
            Rating tier
          </div>
          <div className="text-xl font-extrabold leading-tight">
            {tier.name}
          </div>
          {/* Star-strip — 7 chips, ordinal filled */}
          <div
            className="mt-2 flex gap-1"
            aria-label={`Tier ${tier.ordinal} of 7`}
          >
            {Array.from({ length: 7 }).map((_, i) => {
              const filled = i < tier.ordinal;
              return (
                <span
                  key={i}
                  className="inline-block h-1.5 w-4 rounded-full"
                  style={{
                    background: filled
                      ? tier.accent
                      : "rgba(255,255,255,0.18)",
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">
            ELO
          </div>
          <div className="font-mono text-2xl font-extrabold tabular-nums">
            {rating}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Apply an alpha to a `#rrggbb` hex color. Light-touch helper local to this
 * component — we don't want to drag in a real color util just for this.
 */
function withAlpha(hex: string, a: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) {
    return `rgba(255,255,255,${a})`;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
