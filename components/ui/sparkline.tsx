import { cn } from "@/lib/utils";

/**
 * Round-47 — tiny inline SVG sparkline. Inputs are raw datapoints; we
 * scale + draw a polyline + a translucent area fill. Works for ratings,
 * win-rate trends, anything single-series.
 */
export function Sparkline({
  data,
  width = 160,
  height = 36,
  stroke = "currentColor",
  fill = "currentColor",
  className,
}: {
  data: ReadonlyArray<number>;
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
}) {
  if (data.length < 2) {
    return (
      <div
        className={cn("text-[10px] text-muted-foreground", className)}
        style={{ width, height }}
      >
        Not enough data yet — play more matches.
      </div>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const padY = 2;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - padY - ((v - min) / span) * (height - padY * 2);
    return [x, y] as const;
  });
  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const last = data[data.length - 1]!;
  const first = data[0]!;
  const trendUp = last >= first;

  return (
    <svg
      role="img"
      aria-label={`Rating trend, ${data.length} points, ${last - first >= 0 ? "+" : ""}${last - first}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block", className)}
    >
      <path d={areaPath} fill={fill} opacity={0.12} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.5} />
      {/* Highlight the last point */}
      <circle
        cx={points[points.length - 1]![0]}
        cy={points[points.length - 1]![1]}
        r={2.5}
        fill={stroke}
      />
      {/* Subtle baseline dot for the first point so the trajectory is obvious */}
      <circle
        cx={points[0]![0]}
        cy={points[0]![1]}
        r={1.5}
        fill={stroke}
        opacity={trendUp ? 0.4 : 0.4}
      />
    </svg>
  );
}
