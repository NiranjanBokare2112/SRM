import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local phone testing through this computer's Wi-Fi address.
  allowedDevOrigins: ["10.183.253.230"],
  // Keep the dev-only Next.js badge clear of the admin sidebar's Sign out button.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
