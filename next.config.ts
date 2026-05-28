import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  async rewrites() {
    return [
      {
        source: "/api/complaints/:path*",
        destination: "https://sispaa-router-backend.onrender.com/api/complaints/:path*",
      },
    ];
  },
};

export default nextConfig;
