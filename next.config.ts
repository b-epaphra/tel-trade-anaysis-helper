import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["dukascopy-node", "telegram", "fastest-validator", "prettier", "cli-highlight"],
};

export default nextConfig;
