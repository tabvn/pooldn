import { ImageResponse } from "next/og";
import { brandMark } from "@/lib/icons/brand-mark";

// Browser-tab favicon. Rounded so it doesn't read as a hard square in
// platforms (browsers, OS recent-apps) that don't apply their own mask.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(brandMark({ size: 64, rounded: true }), { ...size });
}
