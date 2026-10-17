import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: [
    "@electric-sql/pglite",
    "postgres",
    "drizzle-orm",
  ],
};

export default nextConfig;
