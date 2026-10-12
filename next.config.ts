import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@electric-sql/pglite",
    "postgres",
    "drizzle-orm",
  ],
};

export default nextConfig;
