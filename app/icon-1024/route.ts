import { ImageResponse } from "next/og";
import { brandMark } from "@/lib/icons/brand-mark";

/**
 * Facebook/store-submission app icon — 1024×1024 PNG, flat square (Facebook
 * masks the corners on its side). Reachable at `/icon-1024` and served with
 * `Content-Disposition: attachment` so visiting it downloads
 * `pooldn-app-icon-1024.png` ready for the Facebook App dashboard.
 *
 *  curl http://localhost:3000/icon-1024 -o pooldn-app-icon-1024.png
 */
export const runtime = "nodejs";

export async function GET() {
  const img = new ImageResponse(brandMark({ size: 1024, rounded: false }), {
    width: 1024,
    height: 1024,
  });
  const buf = await img.arrayBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition":
        'attachment; filename="pooldn-app-icon-1024.png"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
