import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  transpilePackages: ["@ocop/core", "@ocop/infra", "@ocop/ui"],
  serverExternalPackages: ["pg", "pg-boss", "@node-rs/argon2"],
  poweredByHeader: false,
  // Phiên bản tiêu chí files are sent to a server action (QĐ 26 is about 1 MB; core caps at 5 MB).
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default config;
