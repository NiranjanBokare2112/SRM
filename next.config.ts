import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local phone testing through this computer's Wi-Fi address.
  allowedDevOrigins: ["10.183.253.230"],
};

export default nextConfig;
