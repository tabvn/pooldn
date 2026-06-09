/**
 * Round-47 — single source of truth for the PoolDN brand mark used by every
 * app-icon endpoint (favicon, apple-touch, Facebook 1024). Returns JSX shaped
 * for `next/og` ImageResponse (Satori), NOT for the React DOM renderer.
 *
 * Design: dark mist gradient background → lime cue-ball in the center → bold
 * "8" character cut into the ball. The lime brand colour is what makes the
 * mark instantly readable at any size; we drop the thin lime ring used in the
 * in-app PoolBallLogo because rings collapse to one or two pixels at 32×32
 * and read as noise.
 *
 *  - rounded=true   → 22% border-radius (iOS-style). Use for favicon where
 *                     the platform does NOT mask the icon.
 *  - rounded=false  → square. Apple-touch and Facebook auto-mask, so we
 *                     ship them flat and let them apply the platform shape.
 */
export function brandMark({
  size,
  rounded,
}: {
  size: number;
  rounded: boolean;
}) {
  const ballSize = Math.round(size * 0.72);
  const eightSize = Math.round(size * 0.5);
  const radius = rounded ? Math.round(size * 0.22) : 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 50% 35%, #1f262a 0%, #0c1012 75%)",
        borderRadius: radius,
      }}
    >
      <div
        style={{
          width: ballSize,
          height: ballSize,
          borderRadius: ballSize,
          background:
            "radial-gradient(circle at 35% 30%, #e7ff4d 0%, #d0f30d 55%, #a8c70b 100%)",
          boxShadow:
            "0 0 " +
            Math.round(size * 0.08) +
            "px " +
            Math.round(size * 0.02) +
            "px rgba(208,243,13,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: eightSize,
            fontWeight: 900,
            lineHeight: 1,
            color: "#0c1012",
            letterSpacing: "-0.05em",
            display: "flex",
          }}
        >
          8
        </div>
      </div>
    </div>
  );
}
