import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Round-47 — whitelist remote image hosts the app actually loads from.
  // Today the Avatar component uses a plain <img>, so this list is
  // future-proofing for when we migrate to next/image. Keep the list
  // tight — every new host has to be added explicitly.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
};

export default nextConfig;
