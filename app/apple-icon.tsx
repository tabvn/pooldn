import { ImageResponse } from "next/og";
import { brandMark } from "@/lib/icons/brand-mark";

// Apple touch icon (Home Screen, iOS share sheet, Safari pinned tab).
// iOS applies its own rounded mask, so we ship the artwork as a flat square.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(brandMark({ size: 180, rounded: false }), { ...size });
}
