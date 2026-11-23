import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "dhikr.saif.space" }],
        destination: "https://dhikr.farishta.si/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
